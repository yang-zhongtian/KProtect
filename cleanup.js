import {unlinkSync} from 'fs'
import path from 'path'

const workingDir = path.resolve(path.resolve(), 'dist')

const remove = file => {
    try {
        unlinkSync(path.resolve(workingDir, file))
    } catch (exception) {
    }
}

remove('bundle.js')
remove('bundle.umd.js')
remove('bundle.es.js')
