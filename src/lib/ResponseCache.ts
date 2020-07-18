import * as vscode from 'vscode'

import { FileData, FilesSearchResponse, FileType } from '../handlers/FileHandler'

import { Mutex } from 'async-mutex'

type FileTypeByPath = { [key: string]: { identifier: string, file: FileData }[] }

class ResponseCache {
  private map: { [key in FileType]?: FileTypeByPath } = {}
  private mutexes: { [key in FileType]?: Mutex } = {}

  public emptyCache () {
    // console.log('emptying cache')
    this.map = {}
  }

  public purgeAllByType (type: FileType) {
    if (this.map.hasOwnProperty(type)) {
      delete this.map[type]
    }
  }

  /**
   * Acquire a mutex for a file type
   * @param type the type of which to acquire the mutex for
   */
  public async acquireMutex (type: FileType) {
    if (!this.mutexes[type]) this.mutexes[type] = new Mutex()

    return await this.mutexes[type]!.acquire()
  }
 
  public async setOrGetFromCache(type: FileType, fn: () => Promise<FilesSearchResponse>, uri?: vscode.Uri, overwrite?: boolean) {
    // for this bulk function, a mutex is used to prevent multiple requests at the same time
    const release = await this.acquireMutex(type)

    const path = uri?.path

    if (!this.checkCache(type, path) || overwrite) {
      this.setCache(type, await fn(), uri)
    }

    release()

    return this.fromCache(type, path)
  }

  public checkCache (type: FileType, path?: string) {
    if (this.map.hasOwnProperty(type)) {
      if (!path) return true
      else {
        return Object.keys(this.map[type]!).includes(path)
      }
    }
    return false
  }

  public fromCache(type: FileType, path?: string): FilesSearchResponse {
    let response: FilesSearchResponse = { files: [], identifiers: [] }

    const mapObject = this.map[type]!

    // console.log('fromCache', FileType[type])

    if (!path) {
      for (let path of Object.keys(mapObject)) {
        const symbols = mapObject[path]
        for (let symbol of symbols) {
          response.files.push(symbol.file)
          response.identifiers.push(symbol.identifier)
        }
      }
    }

    if (path && mapObject.hasOwnProperty(path)) {
      const symbols = mapObject[path]
      response.files = symbols.map(s => s.file)
      response.identifiers = symbols.map(s => s.identifier)
    }

    return response
  }

  public setCache (type: FileType, data: FilesSearchResponse, uri?: vscode.Uri) {
    // console.log('setCache', FileType[type], data)

    if (!this.map.hasOwnProperty(type)) this.map[type] = {}
    let mapObject = this.map[type]!

    // overwrite the current symbols for the paths being updated
    const uriUsed = data.files.map(f => f.uri.path)
    for (let uriPath of uriUsed) mapObject[uriPath] = []

    for (let i = 0; i < data.files.length; i++) {
      const file = data.files[i]

      let filePath = file.uri.path

      // only update the specific uri when specified
      if (uri && filePath !== uri.path) continue

      mapObject[filePath].push({
        identifier: data.identifiers[i],
        file
      })
    }
  }
}

export default ResponseCache
