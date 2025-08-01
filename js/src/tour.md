# Tour of RXF Javascript

## Outline
1. util.js      - general purpose code

2. datapath.js   - convenient syntax for paths with reference equality
3. graph.js     - defining graphs, subgraphs, and traversing those

4. reducing.js  - reducer protocol with library of reducers
5. xflib.js     - transducer library including multiplex and demultiplex
6. xfgraph.js   - graphs of transducers and their composition
7. iograph.js   - transducer graphs composed with edge (source, sink) nodes
8. runner.js    - compose an iograph with a runtime and default edges

## Dependency Graph
* util.js

* datapath.js
* graph.js
| * reducing.js
| * xflib.js
|/
* xfgraph.js
* iograph.js
* runner.js

## Further Reading
