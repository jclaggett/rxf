#!/usr/bin/env node

import { opendir } from 'fs/promises'

import * as rxf from '../src/index.js'
import {
  $, take, takeWhile, takeAll, mapjoin, map, sink, source, prepend,
  after, remove
} from '../src/index.js'

const dirGraph = (
  [dirname, ...dirnames], // active
  { padding, useTitles, showHidden }) => // passive

  rxf.iograph({
    nodes: {
      entries: source('dir', dirname),
      entryNames: rxf.chain(
        showHidden ? takeAll : remove(entry => entry.name.startsWith('.')),
        map(x => `${padding}${x.name}`),
        useTitles ? prepend(`\n${dirname}`) : takeAll),

      log: sink('log'),

      dirRest: after(dirnames),
      dirSink: sink('pipe', 'dirnames'),
      debug: sink('debug')
    },
    links: [
      [$.entries, $.entryNames],
      [$.entryNames, $.log],
      [$.entryNames, $.dirRest],
      [$.dirRest, $.dirSink]
    ]
  })

export const lsGraph = () =>
  rxf.iograph({
    nodes: {
      // Act 1: Collect configuration and start processing dirnames
      init: source('init'),

      config: map(({ argv }) => {
        let dirnames = argv.slice(2)

        let showHidden = false
        if (rxf.first(dirnames) === '-a') {
          dirnames = rxf.rest(dirnames)
          showHidden = true
        }

        const useTitles = dirnames.length > 1
        return {
          useTitles,
          padding: ' '.repeat(useTitles ? 4 : 0),
          dirnames,
          showHidden
        }
      }),

      configDirnames: map(x => x.dirnames),

      dirSink: sink('pipe', 'dirnames'),

      // Act 2: process each dirname in sequence (using config as needed)
      dirSource: source('pipe', 'dirnames'),

      dirnames: takeWhile(dirnames => dirnames.length > 0),

      dirGraph: mapjoin(dirGraph, [{ active: true }, { active: false }]),

      run: sink('run'),
      debug: sink('debug')
    },
    links: [
      [$.init, $.config],
      [$.config, $.debug],
      [$.config, $.configDirnames],
      [$.configDirnames, $.dirSink],
      [$.dirSource, $.dirnames],
      [$.dirnames, $.dirGraph[0]],
      [$.config, $.dirGraph[1]],
      [$.dirGraph, $.run]
    ]
  })

const edges = {
  dir: {
    source: (path) =>
      rxf.transducer(rf => ({
        [rxf.STEP]: async (a, _x) => {
          const dir = await opendir(path)
          for await (const dirent of dir) {
            a = rf[rxf.STEP](a, dirent)
            if (rxf.isReduced(a)) {
              break
            }
          }
          return a
        }
      }))
  }
}

const ls = lsGraph()
// rxf.pg(ls)
// debugger
await rxf.run(ls, { initValue: process, edges })
