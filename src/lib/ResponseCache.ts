import { FilesSearchResponse, FileType } from '../handlers/FileHandler'

class ResponseCache {
  private map: { [key in FileType]?: FilesSearchResponse } = {}

  public emptyCache () {
    // console.log('emptying cache')
    this.map = {}
  }

  public async setOrGetFromCache(type: FileType, fn: () => Promise<FilesSearchResponse>) {
    if (!this.checkCache(type)) this.setCache(type, await fn())
    return this.fromCache(type)
  }

  public checkCache (type: FileType) {
    if (this.map[type]) return true
    return false
  }

  public fromCache(type: FileType) {
    // console.log('fetching', type, 'from cache')
    return this.map[type] as FilesSearchResponse
  }

  public setCache (type: FileType, data: FilesSearchResponse) {
    // console.log('setting', type, 'to cache')
    this.map[type] = data
  }
}

export default ResponseCache
