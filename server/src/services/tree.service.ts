import prisma from '../db/db';
import { ApiError } from '../errors/apiError';

export default class TreeService {
    static t: number = 10;

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
        // Перевіряємо, чи вже існує ключ у дереві
        const existingKey = await prisma.bTreeKey.findFirst({
            where: { key },
        });
    
        // Якщо ключ існує, викидаємо помилку
        if (existingKey) {
            throw ApiError.BadRequestError(`Key ${key} already exists in the B-tree`);
        }
    
        // Отримуємо кореневий вузол дерева
        let rootNode = await prisma.bTreeNode.findFirst({
            where: { root: true },
            include: { keys: true, children: true },
        });
    
        // Якщо кореневий вузол не знайдено, створюємо новий
        if (!rootNode) {
            rootNode = await prisma.bTreeNode.create({
                data: {
                    isLeaf: true, // Новий вузол буде листом
                    root: true,   // Встановлюємо його як кореневий
                    t: this.t,    // Мінімальний ступінь дерева
                    children: { create: [] }, // Дочірні вузли
                    keys: { create: [] }      // Ключі у вузлі
                },
                include: {
                    children: true, // Включаємо дочірні вузли в результат
                    keys: true,     // Включаємо ключі в результат
                },
            });
        }
    
        // Якщо кореневий вузол заповнений, розділяємо його
        if (rootNode.keys.length >= 2 * this.t - 1) {
            // Розділяємо кореневий вузол на дві частини
            const newRoot = await this.splitNode(null, rootNode);
    
            // Оновлюємо кореневий вузол після розбиття
            rootNode = await prisma.bTreeNode.findFirst({
                where: { root: true },
                include: { keys: true, children: true },
            });
        }
    
        // Вставляємо ключ у відповідний вузол дерева
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
        // Calculate the middle index and retrieve the key that will be pushed up to the parent
        const middleIndex = Math.floor(node.keys.length / 2); // Index of the middle key
        const middleKey = node.keys[middleIndex]; // The key to move up to the parent node
    
        // Create a new right child node to hold the larger half of the split keys
        const rightNode = await prisma.bTreeNode.create({
            data: {
                isLeaf: node.isLeaf, // Whether the node is a leaf node
                parentId: parentId, // The parent ID of the newly created right node
                t: this.t, // Minimum degree of the B-Tree
            },
        });
    
        // Split the keys of the current node into two halves
        const leftKeys = node.keys.slice(0, middleIndex); // Keys that remain in the original node (left half)
        const rightKeys = node.keys.slice(middleIndex + 1); // Keys that move to the new right node (right half)
    
        // Move the right keys to the newly created right node
        for (const key of rightKeys) {
            await prisma.bTreeKey.update({
                where: { id: key.id },
                data: { nodeId: rightNode.id }, // Reassign these keys to the right node
            });
        }
    
        // Move the left keys to the original node (as they remain on the left side)
        for (const key of leftKeys) {
            await prisma.bTreeKey.update({
                where: { id: key.id },
                data: { nodeId: node.id }, // Reassign these keys to the left node (original node)
            });
        }
    
        // Remove the middle key from the current node, as it will be moved to the parent
        await prisma.bTreeKey.delete({
            where: { id: middleKey.id },
        });
    
        if (!node.isLeaf) {
            // Handle children nodes if the current node is not a leaf
            const allChildren = await prisma.bTreeNode.findMany({
                where: { parentId: node.id },
                orderBy: { id: 'asc' }, // Ensure children are ordered
            });
    
            // Split the children nodes into left and right
            const leftChildren = allChildren.slice(0, middleIndex + 1); // Children for the left node
            const rightChildren = allChildren.slice(middleIndex + 1); // Children for the right node
    
            // Assign the right children to the newly created right node
            for (const child of rightChildren) {
                await prisma.bTreeNode.update({
                    where: { id: child.id },
                    data: { parentId: rightNode.id }, // Reassign to the right node
                });
            }
    
            // Assign the left children to the original node
            for (const child of leftChildren) {
                await prisma.bTreeNode.update({
                    where: { id: child.id },
                    data: { parentId: node.id }, // Reassign to the left node
                });
            }
        }
    
        if (parentId !== null) {
            // If the current node has a parent, insert the middle key into the parent
            await prisma.bTreeKey.create({
                data: {
                    key: middleKey.key, // The key value
                    value: middleKey.value, // The associated value
                    nodeId: parentId, // Assign the middle key to the parent node
                },
            });
    
            // Add the new right child to the parent's children
            await prisma.bTreeNode.update({
                where: { id: parentId },
                data: {
                    children: {
                        connect: [{ id: rightNode.id }], // Link the new right node to the parent
                    },
                },
            });
    
            // Check if the parent node now requires a split
            const parentKeys = await prisma.bTreeKey.findMany({
                where: { nodeId: parentId },
                orderBy: { key: 'asc' }, // Ensure parent keys are sorted
            });
    
            // If the parent has too many keys, split it as well
            if (parentKeys.length >= 2 * this.t - 1) {
                const parentNode = await prisma.bTreeNode.findUnique({
                    where: { id: parentId },
                    include: { keys: true, children: true }, // Include the parent node's keys and children
                });
                if (parentNode) {
                    await this.splitNode(parentNode.parentId, parentNode); // Recursively split the parent
                }
            }
        } else {
            // If the current node has no parent, create a new root node
            const newRoot = await prisma.bTreeNode.create({
                data: {
                    isLeaf: false, // The new root is not a leaf
                    root: true, // Mark the new node as the root
                    t: this.t, // Minimum degree of the B-Tree
                    children: {
                        connect: [{ id: node.id }, { id: rightNode.id }], // Connect the left and right nodes as children
                    },
                    keys: {
                        create: {
                            key: middleKey.key, // The middle key becomes the root key
                            value: middleKey.value, // Associated value of the key
                        },
                    },
                },
            });
    
            // Update the left and right nodes to point to the new root
            await prisma.bTreeNode.update({
                where: { id: node.id },
                data: { root: false, parentId: newRoot.id }, // Left node is no longer the root
            });
    
            await prisma.bTreeNode.update({
                where: { id: rightNode.id },
                data: { parentId: newRoot.id }, // Right node points to the new root
            });
    
            return newRoot; // Return the new root node
        }
    
        // Return the newly created right node
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

    static async findNodeByKey(key: number): Promise<any | null> {
        console.log(`Searching for the node that contains key: ${key}`);
        
        const node = await prisma.bTreeNode.findFirst({
            where: {
                keys: {
                    some: {
                        key: key,
                    },
                },
            },
            include: {
                keys: true,
            },
        });
    
        if (!node) {
            console.log(`No node contains the key ${key}.`);
            return null;
        }
    
        console.log(`Node containing key ${key} found: ${JSON.stringify(node)}`);
        return node;
    }
    
    /**
     * Performs a binary search to find a key in a sorted array of keys.
     *
     * @param keys - Array of objects, each containing a `key` and `value`.
     * @param key - The key to search for in the array.
     * @returns An object containing the found key, its value, and the number of comparisons made, or `null` if the key is not found.
     */
    static binarySearch(keys: any[], key: number): { key: number, value: string, comparisons: number } | null {
        let left = 0; // Initialize the left boundary of the search range
        let right = keys.length - 1; // Initialize the right boundary of the search range
        let comparisons = 0; // Counter for the number of comparisons made during the search

        console.log(`Binary search start: keys = ${JSON.stringify(keys)}, searchKey = ${key}`); // Log the initial state of the search

        // Continue the search while the range is valid (left <= right)
        while (left <= right) {
            // Calculate the middle index of the current range
            const mid = Math.floor((left + right) / 2);
            const currentKey = keys[mid].key; // Extract the key at the middle index
            comparisons++; // Increment the comparisons counter

            console.log(`Checking middle index ${mid}: currentKey = ${currentKey}, comparisons = ${comparisons}`); // Log the current middle index and key being compared

            if (currentKey === key) {
                // If the middle key matches the search key, return the result
                console.log(`Key found: ${JSON.stringify(keys[mid])}`); // Log the found key and its value
                return { key: keys[mid].key, value: keys[mid].value, comparisons };
            } else if (currentKey < key) {
                // If the search key is greater than the middle key, move the left boundary to the right of the middle
                console.log(`Key is greater than currentKey. Moving right.`);
                left = mid + 1;
            } else {
                // If the search key is less than the middle key, move the right boundary to the left of the middle
                console.log(`Key is less than currentKey. Moving left.`);
                right = mid - 1;
            }
        }

        // If the loop ends, the key is not in the array
        console.log(`Key not found in current node.`);
        return null; // Return null to indicate the key was not found
    }
    
    static async searchKeyInBTree(key: number): Promise<{ key: number, value: string, comparisons: number } | null> {
        console.log(`Starting search for key: ${key} in B-Tree.`);
    
        const node = await this.findNodeByKey(key);
        if (!node) {
            console.log(`Key ${key} not found in any node.`);
            return null;
        }
    
        node.keys.sort((a: { key: number; }, b: { key: number; }) => a.key - b.key);
        console.log(`Sorted keys in the node: ${JSON.stringify(node.keys)}`);
    
        const result = this.binarySearch(node.keys, key);
    
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
               
    /**
     * Finds the maximum key in the subtree rooted at the specified node.
     * 
     * @param nodeId - ID of the root node of the subtree.
     * @returns The maximum key and its associated value, or null if the node is empty.
     * @throws ApiError.BadRequestError - If the node does not exist or has an invalid structure.
     */
    static async getMaxKeyInSubtree(nodeId: number): Promise<{ key: number, value: string } | null> {
        console.log(`Finding max key in subtree of node ${nodeId}`);

        // Fetch the node and its details
        const node = await prisma.bTreeNode.findUnique({
            where: { id: nodeId },
            include: { keys: true, children: true },
        });
        if (!node) {
            throw ApiError.BadRequestError(`Node with id ${nodeId} not found`);
        }

        // If the node is a leaf, find the maximum key
        if (node.isLeaf) {
            const maxKey = node.keys.reduce((max, current) => 
                current.key > max.key ? current : max, node.keys[0]);
            return maxKey ? { key: maxKey.key, value: maxKey.value } : null;
        }

        // Recur into the rightmost child for non-leaf nodes
        const rightmostChild = node.children[node.children.length - 1];
        if (!rightmostChild) {
            throw ApiError.BadRequestError(`Node with id ${nodeId} has invalid structure`);
        }
        return await this.getMaxKeyInSubtree(rightmostChild.id);
    }

    /**
     * Finds the minimum key in the subtree rooted at the specified node.
     * 
     * @param nodeId - ID of the root node of the subtree.
     * @returns The minimum key and its associated value, or null if the node is empty.
     * @throws ApiError.BadRequestError - If the node does not exist or has an invalid structure.
     */
    static async getMinKeyInSubtree(nodeId: number): Promise<{ key: number, value: string } | null> {
        console.log(`Finding min key in subtree of node ${nodeId}`);

        // Fetch the node and its details
        const node = await prisma.bTreeNode.findUnique({
            where: { id: nodeId },
            include: { keys: true, children: true },
        });
        if (!node) {
            throw ApiError.BadRequestError(`Node with id ${nodeId} not found`);
        }

        // If the node is a leaf, find the minimum key
        if (node.isLeaf) {
            const minKey = node.keys.reduce((min, current) => 
                current.key < min.key ? current : min, node.keys[0]);
            return minKey ? { key: minKey.key, value: minKey.value } : null;
        }

        // Recur into the leftmost child for non-leaf nodes
        const leftmostChild = node.children[0];
        if (!leftmostChild) {
            throw ApiError.BadRequestError(`Node with id ${nodeId} has invalid structure`);
        }
        return await this.getMinKeyInSubtree(leftmostChild.id);
    } 

    // Основний метод видалення ключа з B-дерева
    static async deleteKey(key: number) {
        console.log(`Starting deletion for key: ${key}`);
        
        // Знайти вузол, що містить ключ
        const node = await this.findNodeByKey(key);
        if (!node) {
            console.error(`Key ${key} not found in the B-tree`);
            throw ApiError.BadRequestError(`Key ${key} not found in the B-tree`);
        }
        
        console.log(`Key ${key} found in node ${node.id}`);
        
        // Видалення ключа з вузла
        await this.deleteFromNode(node.id, key);
        
        // Оновлення дерева у разі порожнього кореневого вузла
        const rootNode = await prisma.bTreeNode.findFirst({
            where: { root: true },
            include: { keys: true, children: true },
        });
        
        // Якщо кореневий вузол порожній, а у нього є нащадки, новий корінь призначається його першим нащадком
        if (rootNode?.keys.length === 0 && rootNode.children.length > 0) {
            console.log(`Root node ${rootNode.id} is empty. Adjusting root`);
            const newRoot = rootNode.children[0];
            await prisma.bTreeNode.update({
                where: { id: newRoot.id },
                data: { root: true, parentId: null },
            });
            await prisma.bTreeNode.delete({ where: { id: rootNode.id } });
            console.log(`Deleted old root node ${rootNode.id}`);
        }
        
        console.log(`Deletion for key ${key} completed`);
    }
    
    // Видалення ключа з конкретного вузла
    static async deleteFromNode(nodeId: number, key: number) {
        console.log(`Starting deleteFromNode for nodeId: ${nodeId}, key: ${key}`);
        
        // Отримати вузол з бази даних
        const node = await prisma.bTreeNode.findUnique({
            where: { id: nodeId },
            include: { keys: true, children: true },
        });

        if (!node) {
            console.error(`Node with id ${nodeId} not found`);
            throw ApiError.BadRequestError(`Node with id ${nodeId} not found`);
        }
        console.log(`Fetched node: ${JSON.stringify(node)}`);

        // Пошук індексу ключа у вузлі
        const keyIndex = node.keys.findIndex((k) => k.key === key);
        console.log(`Key index in node: ${keyIndex}`);

        if (keyIndex !== -1) {
            console.log(`Key ${key} found in node ${node.id} at index ${keyIndex}`);
            
            if (node.isLeaf) {
                // Якщо це листовий вузол, просто видаляємо ключ
                await prisma.bTreeKey.delete({ where: { id: node.keys[keyIndex].id } });
                console.log(`Deleted key ${key} from leaf node ${node.id}`);
            } else {
                // Якщо це внутрішній вузол, потрібно замінити ключ на предка або нащадка
                const leftChild = await prisma.bTreeNode.findUnique({
                    where: { id: node.children[keyIndex].id },
                    include: { keys: true, children: true },
                });
                const rightChild = await prisma.bTreeNode.findUnique({
                    where: { id: node.children[keyIndex + 1].id },
                    include: { keys: true, children: true },
                });

                if (!leftChild || !rightChild) {
                    throw ApiError.BadRequestError(`Invalid structure for node ${node.id}`);
                }

                // Використання предка або нащадка для заміни ключа
                if (leftChild.keys.length >= this.t) {
                    // Знайти максимальний ключ у лівому піддереві
                    const predecessor = await this.getMaxKeyInSubtree(leftChild.id);
                    if (predecessor) {
                        await prisma.bTreeKey.update({
                            where: { id: node.keys[keyIndex].id },
                            data: { key: predecessor.key, value: predecessor.value },
                        });
                        console.log(`Replaced key ${key} with predecessor ${predecessor.key}`);
                        await this.deleteFromNode(leftChild.id, predecessor.key);
                    }
                } else if (rightChild.keys.length >= this.t) {
                    // Знайти мінімальний ключ у правому піддереві
                    const successor = await this.getMinKeyInSubtree(rightChild.id);
                    if (successor) {
                        await prisma.bTreeKey.update({
                            where: { id: node.keys[keyIndex].id },
                            data: { key: successor.key, value: successor.value },
                        });
                        console.log(`Replaced key ${key} with successor ${successor.key}`);
                        await this.deleteFromNode(rightChild.id, successor.key);
                    }
                } else {
                    // Якщо у обох нащадків недостатньо ключів, виконується злиття
                    await this.mergeNodes(nodeId, keyIndex);
                    console.log(`Merged nodes for key ${key}`);
                    await this.deleteFromNode(leftChild.id, key);
                }
            }
        } else {
            // Ключ не знайдено у поточному вузлі, спускаємось у відповідного нащадка
            console.log(`Key ${key} not found in node ${node.id}. Descending into child nodes.`);
            if (node.isLeaf) {
                console.error(`Key ${key} not found in leaf node ${node.id}`);
                throw ApiError.BadRequestError(`Key ${key} not found in the B-tree`);
            }

            // Визначення індексу нащадка
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

            // Балансування вузла перед видаленням
            if (targetChild.keys.length < this.t) {
                console.log(`Child node ${targetChild.id} has fewer than ${this.t} keys. Ensuring balance...`);
                await this.ensureChildHasEnoughKeys(nodeId, childIndex);
            }

            // Повторна спроба видалення після балансування
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
    
        // Отримання вузла-батька
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
        if (!child) {
            console.error(`Child node at index ${childIndex} of parent ${parentId} not found`);
            throw ApiError.BadRequestError(`Child node at index ${childIndex} of parent ${parentId} not found`);
        }
        console.log(`Target child node to ensure enough keys: ${JSON.stringify(child)}`);
    
        // Пошук лівого брата
        const leftSibling = childIndex > 0 
            ? await prisma.bTreeNode.findUnique({
                where: { id: parent.children[childIndex - 1].id },
                include: { keys: true, children: true },
            }) 
            : null;
        console.log(
            leftSibling
                ? `Found left sibling with id ${leftSibling.id}: ${JSON.stringify(leftSibling)}`
                : `No left sibling for child at index ${childIndex}`
        );
    
        // Пошук правого брата
        const rightSibling = childIndex < parent.children.length - 1
            ? await prisma.bTreeNode.findUnique({
                where: { id: parent.children[childIndex + 1].id },
                include: { keys: true, children: true },
            })
            : null;
        console.log(
            rightSibling
                ? `Found right sibling with id ${rightSibling.id}: ${JSON.stringify(rightSibling)}`
                : `No right sibling for child at index ${childIndex}`
        );
    
        // Спроба запозичити ключ від лівого брата
        if (leftSibling && leftSibling.keys.length >= this.t) {
            console.log(`Left sibling ${leftSibling.id} has enough keys. Borrowing from left sibling.`);
            const borrowedKey = leftSibling.keys[leftSibling.keys.length - 1];
            console.log(`Borrowing key ${JSON.stringify(borrowedKey)} from left sibling.`);
    
            await prisma.bTreeKey.update({
                where: { id: parent.keys[childIndex - 1].id },
                data: { key: borrowedKey.key, value: borrowedKey.value },
            });
            await prisma.bTreeKey.delete({ where: { id: borrowedKey.id } });
            console.log(`Borrowed key ${borrowedKey.key} successfully and updated parent.`);
        }
        // Спроба запозичити ключ від правого брата
        else if (rightSibling && rightSibling.keys.length >= this.t) {
            console.log(`Right sibling ${rightSibling.id} has enough keys. Borrowing from right sibling.`);
            const borrowedKey = rightSibling.keys[0];
            console.log(`Borrowing key ${JSON.stringify(borrowedKey)} from right sibling.`);
    
            await prisma.bTreeKey.update({
                where: { id: parent.keys[childIndex].id },
                data: { key: borrowedKey.key, value: borrowedKey.value },
            });
            await prisma.bTreeKey.delete({ where: { id: borrowedKey.id } });
            console.log(`Borrowed key ${borrowedKey.key} successfully and updated parent.`);
        }
        // Якщо у братів недостатньо ключів, виконується злиття
        else {
            console.log(`Cannot borrow key from siblings. Proceeding with merging.`);
            if (leftSibling) {
                console.log(`Merging child ${child.id} with left sibling ${leftSibling.id}.`);
                await this.mergeNodes(parentId, childIndex - 1);
                console.log(`Merged successfully with left sibling ${leftSibling.id}.`);
            } else if (rightSibling) {
                console.log(`Merging child ${child.id} with right sibling ${rightSibling.id}.`);
                await this.mergeNodes(parentId, childIndex);
                console.log(`Merged successfully with right sibling ${rightSibling.id}.`);
            } else {
                console.error(`No valid siblings available for merging.`);
                throw ApiError.BadRequestError(`Cannot ensure enough keys for child ${child.id}`);
            }
        }
        console.log(`Completed ensureChildHasEnoughKeys for parentId: ${parentId}, childIndex: ${childIndex}`);
    }    
}