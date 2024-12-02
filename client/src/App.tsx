import { useMemo } from 'react';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import ToolsMenu from './components/ToolsMenu';
import ReactFlow, { MiniMap, Controls, Background } from 'react-flow-renderer';
import { useTree } from './hooks/useTree';

function App() {
  const { data, error, isFetching } = useTree();

  const { nodes, edges } = useMemo(() => {
    if (!data?.data) return { nodes: [], edges: [] };
  
    const traverseBTree = (
      node: { keys: any; id: { toString: () => any; }; children: any; },
      depth = 0,
      position = 0,
      parentId: string | null = null
    ) => {
      if (!node) return { nodes: [], edges: [] };
  
      const nodeLabel =
        (node.keys || [])
          .map((keyValue: { key: any; value: any; }) => `Key: ${keyValue.key} Value: ${keyValue.value}`)
          .join(', ') || 'No keys';
  
      const colors = ['#00bcd4', '#4caf50', '#ff9800', '#f44336'];
      const backgroundColor = colors[depth % colors.length];
  
      const currentNode = {
        id: (node.id ?? `node-${Math.random()}`).toString(),
        data: { label: `Node ${node.id ?? 'Unknown'}\n${nodeLabel}` },
        position: {
          x: position * 600 - depth * 600,
          y: depth * 350,
        },
        style: {
          backgroundColor,
          color: 'white',
          borderRadius: '3px',
          padding: '5px',
          fontSize: '10px',
          fontWeight: 'normal',
        },
      };
  
      const currentEdges = parentId
        ? [
            {
              id: `e${parentId}-${node.id ?? 'default-id'}`,
              source: (parentId ?? 'default-parent-id').toString(),
              target: (node.id ?? 'default-id').toString(),
            },
          ]
        : [];
  
      let childNodes: any[] = [];
      let childEdges: any[] = [];
  
      (node.children || []).forEach((child: { keys: any; id: { toString: () => any; }; children: any; }, index: number) => {
        const { nodes: childNodesPart, edges: childEdgesPart } = traverseBTree(
          child,
          depth + 1,
          position * 1.5 + index,
          node.id?.toString() ?? null
        );
        childNodes.push(...childNodesPart);
        childEdges.push(...childEdgesPart);
      });
  
      return {
        nodes: [currentNode, ...childNodes],
        edges: [...currentEdges, ...childEdges],
      };
    };
  
    return traverseBTree(data.data);
  }, [data]);  

  return (
    <Container
      maxWidth={false}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '96vw',
        bgcolor: 'background.default',
        padding: 0,
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          flex: 1,
          padding: 2,
        }}
      >
        <Box sx={{ flexBasis: '250px', bgcolor: 'background.paper', borderRadius: 1 }}>
          <ToolsMenu />
        </Box>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'background.paper',
            borderRadius: 1,
            marginLeft: 2,
            padding: 2,
            position: 'relative',
            zIndex: 10,
          }}
        >
          {isFetching ? (
            <CircularProgress />
          ) : error ? (
            <Typography color="error">{`Error: ${error.message}`}</Typography>
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}
            >
              <ReactFlow
                nodes={nodes || []}
                edges={edges || []}
                fitView
                style={{ width: '100%', height: '100%' }}
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            </Box>
          )}
        </Box>
      </Box>
    </Container>
  );
}

export default App;
