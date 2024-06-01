function createGraph(V, E) {
    // V - Number of vertices in graph
    // E - Number of edges in graph (u,v,w)
    const adjList = [] // Adjacency list
    for (let i = 0; i < V; i++) {
        adjList.push([])
    }
    for (let i = 0; i < E.length; i++) {
        adjList[E[i][0]].push([E[i][1], E[i][2]])
        adjList[E[i][1]].push([E[i][0], E[i][2]])
    }
    return adjList
}

function djikstra(graph, V, src) {
    const vis = Array(V).fill(0)
    const dist = []
    for (let i = 0; i < V; i++) dist.push([10000, -1])
    dist[src][0] = 0

    for (let i = 0; i < V - 1; i++) {
        let mn = -1
        for (let j = 0; j < V; j++) {
            if (vis[j] === 0) {
                if (mn === -1 || dist[j][0] < dist[mn][0]) mn = j
            }
        }

        vis[mn] = 1
        for (let j = 0; j < graph[mn].length; j++) {
            const edge = graph[mn][j]
            if (vis[edge[0]] === 0 && dist[edge[0]][0] > dist[mn][0] + edge[1]) {
                dist[edge[0]][0] = dist[mn][0] + edge[1]
                dist[edge[0]][1] = mn
            }
        }
    }

    return dist
}

function test(V,E){
    const graph = createGraph(V, E)
    return djikstra(graph, V, 0)
}

module.exports = test;
