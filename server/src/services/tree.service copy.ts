import prisma from '../db/db';
import { ApiError } from '../errors/apiError';

export default class TreeService {
    static t: number = 2;

    static buildTree(node: any, nodes: any[]): any {
        const sortedKeys = node.keys.sort((a: any, b: any) => a.key - b.key);
    
        const children = nodes.filter((childNode: any) => childNode.parentId === node.id);
    
        const sortedChildren = children.sort((a: any, b: any) => {
            const maxKeyA = a.keys.length ? Math.max(...a.keys.map((k: any) => k.key)) : -Infinity;
            const maxKeyB = b.keys.length ? Math.max(...b.keys.map((k: any) => k.key)) : -Infinity;
            return maxKeyA - maxKeyB;
        });
    
        const childrenTrees = sortedChildren.map((child) => this.buildTree(child, nodes));
    
        return {
            id: node.id,
            keys: sortedKeys,
            children: childrenTrees
        };
    }
    
    static async fetchBTree() {
        const nodes = await prisma.bTreeNode.findMany({
            include: {
                keys: true,
            },
        });
    
        if (nodes.length === 0) {
            return null;
        }
    
        const rootNodes = nodes.filter((node) => node.parentId === null);
    
        if (rootNodes.length === 0) {
            throw ApiError.BadRequestError('Дерево некоректне: відсутній кореневий вузол');
        }
    
        const trees = rootNodes.map((rootNode) => this.buildTree(rootNode, nodes));
    
        return trees.length === 1 ? trees[0] : trees;
    }
    
    static async addKey(key: number, value: string) {
        const existingKey = await prisma.bTreeKey.findFirst({
            where: { key },
        });
    
        if (existingKey) {
            throw ApiError.BadRequestError(`Key ${key} already exists in the B-tree`);
        }
    
        let rootNode = await prisma.bTreeNode.findFirst({
            where: { root: true },
            include: { keys: true, children: true },
        });
    
        if (!rootNode) {
            rootNode = await prisma.bTreeNode.create({
                data: {
                    isLeaf: true,
                    root: true,
                    t: this.t,
                    children: { create: [] },
                    keys: { create: [] }
                },
                include: {
                    children: true,
                    keys: true,
                },
            });
        }
    
        if (rootNode.keys.length >= 2 * this.t - 1) {
            const newRoot = await this.splitNode(null, rootNode);
    
            rootNode = await prisma.bTreeNode.findFirst({
                where: { root: true },
                include: { keys: true, children: true },
            });
        }
    
        await this.insertNonFull(rootNode, key, value);
    }
         
    static async insertNonFull(node: any, key: number, value: string) {
        console.log(`\nProcessing node ID: ${node.id}, isLeaf: ${node.isLeaf}`);
        console.log(`Keys in current node: ${node.keys.map((k: any) => k.key)}`);
        console.log(`Key to insert: ${key}`);
    
        if (node.isLeaf) {
            console.log(`Node ${node.id} is a leaf. Adding key ${key}.`);
    
            // Insert key into the leaf node
            await prisma.bTreeKey.create({
                data: { key, value, nodeId: node.id },
            });
    
            // Retrieve updated keys and sort them
            const updatedKeys = await prisma.bTreeKey.findMany({
                where: { nodeId: node.id },
                orderBy: { key: 'asc' }, // Sorting by key
            });
    
            node.keys = updatedKeys;
            console.log(`Updated keys in leaf node ${node.id}: ${updatedKeys.map((k: any) => k.key)}`);
    
            // Ensure that keys in the node are sorted
            node.keys.sort((a: any, b: any) => a.key - b.key); // Explicitly sort keys
    
            if (node.keys.length >= 2 * this.t - 1) {
                console.log(`Node ${node.id} has reached max capacity. Splitting node.`);
                await this.splitNode(node.parentId, node);
            }
        } else {
            console.log(`Node ${node.id} is not a leaf. Finding suitable child node for key ${key}.`);
    
            const children = await prisma.bTreeNode.findMany({
                where: { parentId: node.id },
                include: { keys: true, children: true },
                orderBy: { id: 'asc' },
            });
    
            console.log(`Children of node ${node.id}:`, children.map((c: any) => ({
                id: c.id,
                keys: c.keys.map((k: any) => k.key),
            })));
    
            // Determine the target child node based on parent and child key ranges
            let targetChild: any = null;

            for (let i = 0; i <= children.length; i++) {
                const minKey = i === 0 ? -Infinity : node.keys[i - 1].key; // Min range: -∞ for the first child
                const maxKey = i < node.keys.length ? node.keys[i].key : Infinity; // Max range: ∞ for the last child

                if (key >= minKey && key < maxKey) {
                    targetChild = children[i];
                    console.log(`Key ${key} fits in range [${minKey}, ${maxKey}). Targeting child node ${children[i].id}`);
                    break;
                }
            }

            // Ensure a valid targetChild is found
            if (!targetChild) {
                console.error(`No suitable child found for key ${key}.`);
                throw ApiError.BadRequestError(`Key ${key} cannot be placed in the tree structure.`);
            }
    
            console.log(`Target child node for key ${key} is node ID: ${targetChild.id}`);
    
            await this.insertNonFull(targetChild, key, value);
    
            const childKeys = await prisma.bTreeKey.findMany({
                where: { nodeId: targetChild.id },
                orderBy: { key: 'asc' },
            });
    
            console.log(`Updated keys in child node ${targetChild.id}: ${childKeys.map((k: any) => k.key)}`);
    
            // Ensure that keys in the child node are sorted
            childKeys.sort((a: any, b: any) => a.key - b.key);
    
            if (childKeys.length >= 2 * this.t - 1) {
                console.log(`Child node ${targetChild.id} has reached max capacity. Splitting node.`);
                await this.splitNode(node.id, targetChild);
            }
        }
    }
     
    static async splitNode(parentId: number | null, node: any) {
        const middleIndex = Math.floor(node.keys.length / 2); // Middle index for splitting
        const middleKey = node.keys[middleIndex]; // The key that will be pushed up to the parent
    
        // Create right child node
        const rightNode = await prisma.bTreeNode.create({
            data: {
                isLeaf: node.isLeaf,
                parentId: parentId,
                t: this.t,
            },
        });
    
        // Split keys: Left side and right side
        const leftKeys = node.keys.slice(0, middleIndex);  // The smaller half of the keys
        const rightKeys = node.keys.slice(middleIndex + 1); // The larger half of the keys
    
        // Move the right keys to the new right node
        for (const key of rightKeys) {
            await prisma.bTreeKey.update({
                where: { id: key.id },
                data: { nodeId: rightNode.id },
            });
        }
    
        // Move the left keys to the original node (left side)
        for (const key of leftKeys) {
            await prisma.bTreeKey.update({
                where: { id: key.id },
                data: { nodeId: node.id },
            });
        }
    
        // Delete the middle key, since it is now moved to the parent
        await prisma.bTreeKey.delete({
            where: { id: middleKey.id },
        });
    
        if (!node.isLeaf) {
            // Handle the children if the node is not a leaf
            const allChildren = await prisma.bTreeNode.findMany({
                where: { parentId: node.id },
                orderBy: { id: 'asc' },
            });
    
            const leftChildren = allChildren.slice(0, middleIndex + 1);  // Children for the left side
            const rightChildren = allChildren.slice(middleIndex + 1);  // Children for the right side
    
            // Move the children to the new right node
            for (const child of rightChildren) {
                await prisma.bTreeNode.update({
                    where: { id: child.id },
                    data: { parentId: rightNode.id },
                });
            }
    
            // Move the children to the original node (left side)
            for (const child of leftChildren) {
                await prisma.bTreeNode.update({
                    where: { id: child.id },
                    data: { parentId: node.id },
                });
            }
        }
    
        if (parentId !== null) {
            // Insert the middle key into the parent node
            await prisma.bTreeKey.create({
                data: {
                    key: middleKey.key,
                    value: middleKey.value,
                    nodeId: parentId,
                },
            });
    
            // Add the new right child to the parent's children
            await prisma.bTreeNode.update({
                where: { id: parentId },
                data: {
                    children: {
                        connect: [{ id: rightNode.id }],
                    },
                },
            });
    
            // Check if the parent node needs to be split
            const parentKeys = await prisma.bTreeKey.findMany({
                where: { nodeId: parentId },
                orderBy: { key: 'asc' },
            });
    
            if (parentKeys.length >= 2 * this.t - 1) {
                const parentNode = await prisma.bTreeNode.findUnique({
                    where: { id: parentId },
                    include: { keys: true, children: true },
                });
                if (parentNode) {
                    await this.splitNode(parentNode.parentId, parentNode);
                }
            }
        } else {
            // Create a new root node if there is no parent
            const newRoot = await prisma.bTreeNode.create({
                data: {
                    isLeaf: false,
                    root: true,
                    t: this.t,
                    children: {
                        connect: [{ id: node.id }, { id: rightNode.id }],
                    },
                    keys: {
                        create: {
                            key: middleKey.key,
                            value: middleKey.value,
                        },
                    },
                },
            });
    
            await prisma.bTreeNode.update({
                where: { id: node.id },
                data: { root: false, parentId: newRoot.id },
            });
    
            await prisma.bTreeNode.update({
                where: { id: rightNode.id },
                data: { parentId: newRoot.id },
            });
    
            return newRoot;
        }
    
        return rightNode;
    }
       
    static async editKey(key: number, newValue: string) {
        const existingKey = await prisma.bTreeKey.findFirst({
            where: { key },
        });
    
        if (!existingKey) {
            throw ApiError.BadRequestError(`Key ${key} does not exist in the B-tree`);
        }
    
        const updatedKey = await prisma.bTreeKey.update({
            where: { id: existingKey.id },
            data: { value: newValue },
        });
    
        return { oldKey: updatedKey.key, value: updatedKey.value };
    }

    static binarySearch(keys: any[], key: number): { key: number, value: string, comparisons: number } | null {
        let left = 0;
        let right = keys.length - 1;
        let comparisons = 0;
    
        console.log(`Binary search start: keys = ${JSON.stringify(keys)}, searchKey = ${key}`);
    
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const currentKey = keys[mid].key;
            comparisons++;
    
            console.log(`Checking middle index ${mid}: currentKey = ${currentKey}, comparisons = ${comparisons}`);
    
            if (currentKey === key) {
                console.log(`Key found: ${JSON.stringify(keys[mid])}`);
                return { key: keys[mid].key, value: keys[mid].value, comparisons };
            } else if (currentKey < key) {
                console.log(`Key is greater than currentKey. Moving right.`);
                left = mid + 1;
            } else {
                console.log(`Key is less than currentKey. Moving left.`);
                right = mid - 1;
            }
        }
    
        console.log(`Key not found in current node.`);
        return null;
    }
    
    static async searchByKey(rootNodeId: number, key: number): Promise<{ key: number, value: string, comparisons: number } | null> {
        console.log(`Searching in node with ID: ${rootNodeId}`);
    
        const rootNode = await prisma.bTreeNode.findUnique({
            where: { id: rootNodeId },
            include: { keys: true, children: true },
        });
    
        if (!rootNode) {
            console.log(`Node with ID ${rootNodeId} not found.`);
            return null;
        }
    
        console.log(`Node data: ${JSON.stringify(rootNode)}`);
    
        rootNode.keys.sort((a, b) => a.key - b.key);
        console.log(`Sorted keys: ${JSON.stringify(rootNode.keys)}`);
    
        const result = this.binarySearch(rootNode.keys, key);
        if (result) {
            console.log(`Key found in node ${rootNodeId}: ${JSON.stringify(result)}`);
            return result;
        }
    
        if (rootNode.isLeaf) {
            console.log(`Node ${rootNodeId} is a leaf. Key not found.`);
            return null;
        }
    
        console.log(`Node ${rootNodeId} is not a leaf. Descending to child nodes.`);
    
        let childNodeId = null;
        for (let i = 0; i < rootNode.keys.length; i++) {
            if (key < rootNode.keys[i].key) {
                childNodeId = rootNode.children[i]?.id || null;
                console.log(`Key is less than ${rootNode.keys[i].key}. Going to child node ${childNodeId}.`);
                break;
            }
        }

        if (childNodeId === null && rootNode.children.length > 0) {
            childNodeId = rootNode.children[rootNode.children.length - 1]?.id || null;
            console.log(`Key is greater than all keys. Going to rightmost child node ${childNodeId}.`);
        }
    
        if (childNodeId === null) {
            console.log(`No valid child node found.`);
            return null;
        }
    
        return await this.searchByKey(childNodeId, key);
    }
    
    static async findRootNodeId(): Promise<number | null> {
        console.log(`Finding root node.`);
        const rootNode = await prisma.bTreeNode.findFirst({
            where: { root: true }
        });
    
        if (!rootNode) {
            console.log(`Root node not found.`);
            return null;
        }
    
        console.log(`Root node found: ID = ${rootNode.id}`);
        return rootNode.id;
    }
    
    static async searchKeyInBTree(key: number): Promise<{ key: number, value: string, comparisons: number } | null> {
        console.log(`Starting search for key: ${key} in B-Tree.`);
        const rootNodeId = await this.findRootNodeId();
    
        if (!rootNodeId) {
            console.log(`No root node found. Cannot perform search.`);
            return null;
        }
    
        const result = await this.searchByKey(rootNodeId, key);
    
        if (result) {
            console.log(`Search completed. Key found: ${JSON.stringify(result)}`);
        } else {
            console.log(`Search completed. Key not found.`);
        }
    
        return result;
    }    
    
    static async mergeNodes(parentId: number, keyIndex: number) {
        console.log(`Starting mergeNodes with parentId: ${parentId}, keyIndex: ${keyIndex}`);
        const parent = await prisma.bTreeNode.findUnique({
            where: { id: parentId },
            include: { keys: true, children: true },
        });
        if (!parent) {
            console.error(`Parent node with id ${parentId} not found`);
            throw ApiError.BadRequestError(`Parent node with id ${parentId} not found`);
        }
        console.log(`Fetched parent node: ${JSON.stringify(parent)}`);
    
        const leftChild = parent.children[keyIndex];
        console.log(`Left child: ${JSON.stringify(leftChild)}`);
    
        const rightChild = await prisma.bTreeNode.findUnique({
            where: { id: parent.children[keyIndex + 1].id },
            include: { keys: true, children: true },
        });
        if (!rightChild) {
            console.error(`Right child not found for parent node ${parentId}`);
            throw ApiError.BadRequestError(`Right child not found for parent node ${parentId}`);
        }
        console.log(`Fetched right child: ${JSON.stringify(rightChild)}`);
    
        console.log(`Merging key from parent to left child`);
        await prisma.bTreeKey.create({
            data: {
                key: parent.keys[keyIndex].key,
                value: parent.keys[keyIndex].value,
                nodeId: leftChild.id,
            },
        });
        console.log(`Merged parent key ${parent.keys[keyIndex].key} to left child`);
    
        console.log(`Merging keys from right child to left child`);
        for (const key of rightChild.keys) {
            console.log(`Transferring key ${key.key} to left child`);
            await prisma.bTreeKey.update({
                where: { id: key.id },
                data: { nodeId: leftChild.id },
            });
        }
    
        if (!rightChild.isLeaf) {
            console.log(`Transferring children from right child to left child`);
            for (const child of rightChild.children) {
                console.log(`Transferring child ${child.id} to left child`);
                await prisma.bTreeNode.update({
                    where: { id: child.id },
                    data: { parentId: leftChild.id },
                });
            }
        }
    
        console.log(`Deleting key ${parent.keys[keyIndex].key} from parent`);
        await prisma.bTreeKey.delete({ where: { id: parent.keys[keyIndex].id } });
    
        console.log(`Deleting right child with id ${rightChild.id}`);
        await prisma.bTreeNode.delete({ where: { id: rightChild.id } });
        console.log(`mergeNodes completed for parentId: ${parentId}, keyIndex: ${keyIndex}`);
    }
               
    static async getMaxKeyInSubtree(nodeId: number): Promise<{ key: number, value: string } | null> {
        console.log(`Finding max key in subtree of node ${nodeId}`);
        const node = await prisma.bTreeNode.findUnique({
            where: { id: nodeId },
            include: { keys: true, children: true },
        });
    
        if (!node) {
            console.error(`Node with id ${nodeId} not found`);
            throw ApiError.BadRequestError(`Node with id ${nodeId} not found`);
        }
        console.log(`Fetched node: ${JSON.stringify(node)}`);
    
        if (node.isLeaf) {
            console.log(`Node ${nodeId} is a leaf. Finding max key among ${node.keys.length} keys`);
            const maxKey = node.keys.reduce((max, current) =>
                (current.key > max.key ? current : max), node.keys[0]);
            console.log(`Max key in node ${nodeId}: ${JSON.stringify(maxKey)}`);
            return maxKey ? { key: maxKey.key, value: maxKey.value } : null;
        }
    
        console.log(`Node ${nodeId} is not a leaf. Recursing into the rightmost child`);
        const rightmostChild = node.children[node.children.length - 1];
        if (!rightmostChild) {
            console.error(`Invalid structure: no rightmost child for node ${nodeId}`);
            throw ApiError.BadRequestError(`Node with id ${nodeId} has invalid structure`);
        }
        return await this.getMaxKeyInSubtree(rightmostChild.id);
    }
    
    static async getMinKeyInSubtree(nodeId: number): Promise<{ key: number, value: string } | null> {
        console.log(`Finding min key in subtree of node ${nodeId}`);
        const node = await prisma.bTreeNode.findUnique({
            where: { id: nodeId },
            include: { keys: true, children: true },
        });
    
        if (!node) {
            console.error(`Node with id ${nodeId} not found`);
            throw ApiError.BadRequestError(`Node with id ${nodeId} not found`);
        }
        console.log(`Fetched node: ${JSON.stringify(node)}`);
    
        if (node.isLeaf) {
            console.log(`Node ${nodeId} is a leaf. Finding min key among ${node.keys.length} keys`);
            const minKey = node.keys.reduce((min, current) =>
                (current.key < min.key ? current : min), node.keys[0]);
            console.log(`Min key in node ${nodeId}: ${JSON.stringify(minKey)}`);
            return minKey ? { key: minKey.key, value: minKey.value } : null;
        }
    
        console.log(`Node ${nodeId} is not a leaf. Recursing into the leftmost child`);
        const leftmostChild = node.children[0];
        if (!leftmostChild) {
            console.error(`Invalid structure: no leftmost child for node ${nodeId}`);
            throw ApiError.BadRequestError(`Node with id ${nodeId} has invalid structure`);
        }
        return await this.getMinKeyInSubtree(leftmostChild.id);
    }       

    static async deleteKey(key: number) {
        console.log(`Starting deletion for key: ${key}`);
        const rootNodeId = await this.findRootNodeId();
        if (!rootNodeId) {
            console.error('B-tree is empty');
            throw ApiError.BadRequestError('Cannot delete key: B-tree is empty');
        }
        console.log(`Root node ID: ${rootNodeId}`);
    
        console.log(`Starting recursive deletion for key ${key}`);
        await this.deleteFromNode(rootNodeId, key);
    
        const rootNode = await prisma.bTreeNode.findUnique({
            where: { id: rootNodeId },
            include: { keys: true, children: true },
        });
    
        if (rootNode?.keys.length === 0 && rootNode.children.length > 0) {
            console.log(`Root node ${rootNodeId} is empty. Adjusting root`);
            const newRoot = rootNode.children[0];
            await prisma.bTreeNode.update({
                where: { id: newRoot.id },
                data: { root: true, parentId: null },
            });
            await prisma.bTreeNode.delete({ where: { id: rootNodeId } });
            console.log(`Deleted old root node ${rootNodeId}`);
        }
        console.log(`Deletion for key ${key} completed`);
    }
    
    static async deleteFromNode(nodeId: number, key: number) {
        console.log(`Starting deleteFromNode for nodeId: ${nodeId}, key: ${key}`);
        const node = await prisma.bTreeNode.findUnique({
            where: { id: nodeId },
            include: { keys: true, children: true },
        });
    
        if (!node) {
            console.error(`Node with id ${nodeId} not found`);
            throw ApiError.BadRequestError(`Node with id ${nodeId} not found`);
        }
        console.log(`Fetched node: ${JSON.stringify(node)}`);
    
        const keyIndex = node.keys.findIndex((k) => k.key === key);
        console.log(`Key index in node: ${keyIndex}`);
    
        if (keyIndex !== -1) {
            console.log(`Key ${key} found in node ${node.id} at index ${keyIndex}`);
            if (node.isLeaf) {
                console.log(`Node ${node.id} is a leaf. Deleting key ${key}`);
                await prisma.bTreeKey.delete({ where: { id: node.keys[keyIndex].id } });
                console.log(`Deleted key ${key} from leaf node ${node.id}`);
            } else {
                console.log(`Node ${node.id} is not a leaf. Replacing key ${key}`);
                const leftChild = await prisma.bTreeNode.findUnique({
                    where: { id: node.children[keyIndex].id },
                    include: { keys: true, children: true },
                });
                const rightChild = await prisma.bTreeNode.findUnique({
                    where: { id: node.children[keyIndex + 1].id },
                    include: { keys: true, children: true },
                });
    
                if (leftChild && leftChild.keys.length >= this.t) {
                    console.log(`Left child ${leftChild.id} has enough keys`);
                    const predecessor = await this.getMaxKeyInSubtree(leftChild.id);
                    if (predecessor) {
                        console.log(`Replacing key ${key} with predecessor ${predecessor.key}`);
                        await prisma.bTreeKey.update({
                            where: { id: node.keys[keyIndex].id },
                            data: { key: predecessor.key, value: predecessor.value },
                        });
                        await this.deleteFromNode(leftChild.id, predecessor.key);
                    }
                } else if (rightChild && rightChild.keys.length >= this.t) {
                    console.log(`Right child ${rightChild.id} has enough keys`);
                    const successor = await this.getMinKeyInSubtree(rightChild.id);
                    if (successor) {
                        console.log(`Replacing key ${key} with successor ${successor.key}`);
                        await prisma.bTreeKey.update({
                            where: { id: node.keys[keyIndex].id },
                            data: { key: successor.key, value: successor.value },
                        });
                        await this.deleteFromNode(rightChild.id, successor.key);
                    }
                } else {
                    console.log(`Merging nodes at index ${keyIndex}`);
                    await this.mergeNodes(nodeId, keyIndex);
                    const leftChildId = leftChild ? leftChild.id : null;
                    if (leftChildId) {
                        console.log(`Recursively deleting key ${key} from merged node ${leftChildId}`);
                        await this.deleteFromNode(leftChildId, key);
                    } else {
                        console.error(`Left child not found after merge`);
                        throw ApiError.BadRequestError(`Left child not found for node ${node.id}`);
                    }
                }
            }
        } else {
            console.log(`Key ${key} not found in node ${node.id}. Descending into child nodes.`);
            if (node.isLeaf) {
                console.error(`Key ${key} not found in leaf node ${node.id}`);
                throw ApiError.BadRequestError(`Key ${key} not found in the B-tree`);
            }
    
            let childIndex = 0;
            while (childIndex < node.keys.length && key > node.keys[childIndex].key) {
                childIndex++;
            }
            console.log(`Descending into child at index ${childIndex}`);
    
            const targetChild = await prisma.bTreeNode.findUnique({
                where: { id: node.children[childIndex].id },
                include: { keys: true, children: true },
            });
            if (!targetChild) {
                console.error(`Child node at index ${childIndex} not found`);
                throw ApiError.BadRequestError(`Child node not found for parent node ${node.id}`);
            }
            console.log(`Fetched child node: ${JSON.stringify(targetChild)}`);
    
            if (targetChild.keys.length < this.t) {
                console.log(`Child node ${targetChild.id} has fewer than ${this.t} keys. Ensuring balance...`);
                await this.ensureChildHasEnoughKeys(nodeId, childIndex);
            }
    
            const rebalancedChild = await prisma.bTreeNode.findUnique({
                where: { id: targetChild.id },
                include: { keys: true, children: true },
            });
            if (rebalancedChild) {
                console.log(`Rebalanced child node: ${JSON.stringify(rebalancedChild)}`);
                await this.deleteFromNode(rebalancedChild.id, key);
            } else {
                console.error(`Rebalanced child node not found`);
                throw ApiError.BadRequestError(`Rebalanced child node not found for parent node ${node.id}`);
            }
        }
        console.log(`Completed deleteFromNode for nodeId: ${nodeId}, key: ${key}`);
    }
    
    static async ensureChildHasEnoughKeys(parentId: number, childIndex: number) {
        console.log(`Ensuring child at index ${childIndex} of parent ${parentId} has enough keys`);
        const parent = await prisma.bTreeNode.findUnique({
            where: { id: parentId },
            include: { keys: true, children: true },
        });
    
        if (!parent) {
            console.error(`Parent node with id ${parentId} not found`);
            throw ApiError.BadRequestError(`Parent node with id ${parentId} not found`);
        }
        console.log(`Fetched parent node: ${JSON.stringify(parent)}`);
    
        const child = parent.children[childIndex];
        console.log(`Target child: ${JSON.stringify(child)}`);
    
        const leftSibling = childIndex > 0 ? await prisma.bTreeNode.findUnique({
            where: { id: parent.children[childIndex - 1].id },
            include: { keys: true, children: true },
        }) : null;
        const rightSibling = childIndex < parent.children.length - 1 ? await prisma.bTreeNode.findUnique({
            where: { id: parent.children[childIndex + 1].id },
            include: { keys: true, children: true },
        }) : null;
    
        if (leftSibling && leftSibling.keys.length >= this.t) {
            console.log(`Left sibling ${leftSibling.id} has enough keys. Borrowing from left sibling.`);
            const borrowedKey = leftSibling.keys[leftSibling.keys.length - 1];
            await prisma.bTreeKey.update({
                where: { id: parent.keys[childIndex - 1].id },
                data: { key: borrowedKey.key, value: borrowedKey.value },
            });
            await prisma.bTreeKey.delete({ where: { id: borrowedKey.id } });
            console.log(`Borrowed key ${borrowedKey.key} from left sibling ${leftSibling.id}`);
        } else if (rightSibling && rightSibling.keys.length >= this.t) {
            console.log(`Right sibling ${rightSibling.id} has enough keys. Borrowing from right sibling.`);
            const borrowedKey = rightSibling.keys[0];
            await prisma.bTreeKey.update({
                where: { id: parent.keys[childIndex].id },
                data: { key: borrowedKey.key, value: borrowedKey.value },
            });
            await prisma.bTreeKey.delete({ where: { id: borrowedKey.id } });
            console.log(`Borrowed key ${borrowedKey.key} from right sibling ${rightSibling.id}`);
        } else {
            console.log(`Merging child ${child.id} with a sibling`);
            if (leftSibling) {
                await this.mergeNodes(parentId, childIndex - 1);
                console.log(`Merged child ${child.id} with left sibling ${leftSibling.id}`);
            } else if (rightSibling) {
                await this.mergeNodes(parentId, childIndex);
                console.log(`Merged child ${child.id} with right sibling ${rightSibling.id}`);
            } else {
                console.error(`No valid siblings to merge`);
                throw ApiError.BadRequestError(`Cannot ensure enough keys for child ${child.id}`);
            }
        }
        console.log(`Completed ensureChildHasEnoughKeys for parentId: ${parentId}, childIndex: ${childIndex}`);
    }    
}