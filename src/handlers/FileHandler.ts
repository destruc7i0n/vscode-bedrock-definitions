import * as vscode from 'vscode'

import { Mutex } from 'async-mutex'

import {
  ResourceFile,
  AnimationControllerFile,
  AnimationFile,
  ClientEntityDefinitionFile,
  GeometryFile,
  MaterialFile,
  ParticleFile,
  RenderControllerFile,
  ServerEntityDefinitionFile,
  SoundEffectFile,
  ServerBlockFile,
  DialogueFile,
} from '../files'

type HandlerType = typeof ResourceFile & (new (uri: vscode.Uri) => ResourceFile)

/**
 * The various types of files
 */
export enum FileType {
  None,
  AnimationController,
  Animation,
  RenderController,
  Geometry,
  Material,
  Particle,
  Texture,
  ClientEntityIdentifier,
  ServerEntityIdentifier,
  EventIdentifier,
  ComponentGroup,
  Animate,
  SoundEffect,
  Block,
  Dialogue,

  McFunction,
}

export enum BehaviourDefinitionType {
  Events,
  ComponentGroups,
}

export enum ResourceFilePackType {
  Unknown,
  Behaviour,
  Resource,
}

export type LocationData = { uri: vscode.Uri, range: vscode.Range, resourceFile: ResourceFile }
export type DefinitionLocation = Map<string, LocationData>

export enum DataType {
  Definition,
  ServerEntityEvents,
  ServerEntityComponentGroups,
}

// each type to the files it has
export type FilesData = Map<FileType, FileData>
// the string path to the types of data in the file
export type FileData = Map<string, ResourceFile>
// the types of data to the data amp
export type DataTypeMap = Map<DataType, Data>
// the data ids to the data
export type Data<T = RangeInfo> = Map<string, T>
export type RangeInfo = { range: vscode.Range } & { [additionalProperties: string]: any }
export type ReferencesInfo = RangeInfo & { ref: FileType }

class FileHandler {
  private filesCache: FilesData = new Map()
  private filePathCache: Map<string, { type: FileType, file: ResourceFile }> = new Map()
  private bulkMutex: Map<FileType, Mutex> = new Map()
  private cacheAccessOrder: string[] = []
  private static readonly MAX_CACHE_SIZE = 1000

  private handlers: Map<FileType, HandlerType> = new Map([
    [ FileType.Geometry, GeometryFile ],
    [ FileType.Particle, ParticleFile ],
    [ FileType.Material, MaterialFile ],
    [ FileType.Animation, AnimationFile ],
    [ FileType.AnimationController, AnimationControllerFile ],
    [ FileType.Dialogue, DialogueFile ],
    [ FileType.RenderController, RenderControllerFile ],
    [ FileType.ServerEntityIdentifier, ServerEntityDefinitionFile ],
    [ FileType.ClientEntityIdentifier, ClientEntityDefinitionFile ],
    [ FileType.SoundEffect, SoundEffectFile ],
    [ FileType.Block, ServerBlockFile ],
  ])

  /**
   * Empty the file cache
   */
  public emptyCache () {
    this.filesCache.clear()
    this.filePathCache.clear()
  }

  /**
   * Returns a handler based on the file type provided
   * @param type the type of handler to get
   */
  public getFileHandler (type: FileType) {
    return this.handlers.get(type)
  }

  /**
   * Get file from the path specified
   * Optionally specify type to initialize the file
   * @param file 
   * @param type 
   */
  public async getFile (file: vscode.Uri, type?: FileType): Promise<{ type: FileType, file: ResourceFile } | undefined> {
    const path = file.fsPath
    const cached = this.filePathCache.get(path)
    if (cached) {
      this.updateCacheAccess(path)
      return cached
    }
    
    if (type !== undefined && type !== FileType.None) {
      try {
        const resourceFile = await this.initFile(type, file)
        if (resourceFile) {
          return { type, file: resourceFile }
        }
      } catch (error) {
        console.error(`Failed to get file: ${path}`, error)
      }
    }
    return undefined
  }

  /**
   * Refresh the cache for a file
   * @param file the file to refresh
   */
  public async refreshCacheForFile (file: vscode.Uri) {
    const fileInfo = await this.getFile(file)
    if (fileInfo) {
      const { type, file: resourceFile } = fileInfo
      if (type !== FileType.None) {
        await resourceFile?.extract()
      }
    }
  }

  /**
   * Delete a file by uri from the cache
   * @param file the file to delete from the cache
   */
  public async deleteFileFromCache (file: vscode.Uri) {
    const path = file.fsPath
    const fileData = await this.getFile(file)
    if (fileData) {
      this.filesCache.get(fileData.type)?.delete(path)
      this.filePathCache.delete(path)
      this.removeFromCacheAccess(path)
    }
  }

  /**
   * Initialize file of type in cache
   * @param type 
   * @param file 
   */
  private async initFile (type: FileType, file: vscode.Uri): Promise<ResourceFile | undefined> {
    try {
      if (!this.filesCache.has(type)) {
        this.filesCache.set(type, new Map())
      }

      const typeMap = this.filesCache.get(type)!
      const filePath = file.fsPath
      
      const existingHandler = typeMap.get(filePath)
      if (existingHandler) return existingHandler

      const Handler = this.getFileHandler(type)
      if (!Handler) {
        console.warn(`No handler found for file type: ${FileType[type]}`)
        return undefined
      }

      // Handler is guaranteed to be a concrete class from our handlers map
      const handler = new (Handler as any)(file) as ResourceFile
      await handler.extract()
      
      typeMap.set(filePath, handler)
      this.filePathCache.set(filePath, { type, file: handler })
      this.updateCacheAccess(filePath)
      
      return handler
    } catch (error) {
      console.error(`Failed to initialize file ${file.fsPath}:`, error)
      vscode.window.showErrorMessage(`Failed to process file: ${file.fsPath}`)
      return undefined
    }
  }

  /**
   * Only parse the file if file not in cache
   * @param type the type of data to get
   */
  private async conditionallyExtractFromFileByType (type: FileType) {
    const Handler = this.getFileHandler(type)
    if (!Handler) return
    
    const gen = Handler.getGlobGenerator()
    const BATCH_SIZE = 10

    // show progress while getting all the files
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Updating Bedrock Definitions for "${Handler.title}"...`,
      cancellable: true
    }, async (progress, token) => {
      const batch: vscode.Uri[] = []
      
      for await (const file of gen) {
        if (token.isCancellationRequested) break
        
        batch.push(file)
        
        if (batch.length >= BATCH_SIZE) {
          await Promise.all(batch.map(f => this.initFile(type, f)))
          batch.length = 0
          
          // Update progress
          progress.report({ increment: 1 })
        }
      }
      
      // Process remaining files
      if (batch.length > 0) {
        await Promise.all(batch.map(f => this.initFile(type, f)))
      }
    })
  }

  /**
   * Get a mutex for each type
   * @param type the type to get the mutex for
   */
  private getMutexForType (type: FileType): Mutex {
    let mutex = this.bulkMutex.get(type)
    if (!mutex) {
      mutex = new Mutex()
      this.bulkMutex.set(type, mutex)
    }
    return mutex
  }

  /**
   * Get all data from each file of type
   * @param type the type to get
   */
  public async getAllByType (type: FileType): Promise<FileData> {
    // use a mutex to only run one bulk get a time
    const release = await this.getMutexForType(type).acquire()
    try {
      let fileData = this.filesCache.get(type)
      if (!fileData) {
        await this.conditionallyExtractFromFileByType(type)
        fileData = this.filesCache.get(type) ?? new Map()
      }
      return fileData
    } finally {
      release()
    }
  }

  /**
   * Filters the data by specific data type
   * @param type the type to get
   * @param dataType the specific data to get
   * @param packTypes the types of pack to get
   */
  public async getAllOfTypeByDataType (type: FileType, dataType: DataType, packTypes?: ResourceFilePackType[]): Promise<DefinitionLocation> {
    const map: DefinitionLocation = new Map()

    const fileData = await this.getAllByType(type)
    for (const [ file, resourceFile ] of fileData) {
      const data = resourceFile.get(dataType)
      if (data) {
        for (const [ id, info ] of data) {
          if (packTypes && !packTypes.includes(resourceFile.packType)) continue

          map.set(id, {
            range: info.range,
            uri: vscode.Uri.file(file),
            // put this here in case I need other stuff from it
            resourceFile,
          })
        }
      }
    }

    return map
  }

  /**
   * Returns all identifiers of a type specified
   * @param type the type to find
   * @param packTypes the types of pack to get
   */
  public async getIdentifiersByFileType (type: FileType, packTypes?: ResourceFilePackType[]) {
    return await this.getAllOfTypeByDataType(type, DataType.Definition, packTypes)
  }

  /**
   * Find a specific identifier
   * @param type the type to search
   * @param identifier the specific id
   * @param packTypes the types of pack to get
   */
  public async findByIndentifier (type: FileType, identifier: string, packTypes?: ResourceFilePackType[]) {
    const data = await this.getIdentifiersByFileType(type, packTypes)
    const identifiers = [ ...data.keys() ]
  
    // model and materials may be parented etc
    if ((type === FileType.Material || type === FileType.Geometry) && !data.has(identifier)) {
      const id = identifiers.find(key => key.startsWith(`${identifier}:`))
      if (id) identifier = id
    }
  
    if (data.has(identifier)) return data.get(identifier)!
  }

  /**
   * Get a texture from the string specified
   * @param path the path from which to get the texture from
   */
  public async getTexture (path: string) {
    const textures = await vscode.workspace.findFiles(`**/${path}.{png,tga}`)

    if (textures && textures.length === 1) return textures[0]
  }

  /**
   * Update cache access order for LRU eviction
   * @param path the file path to update
   */
  private updateCacheAccess(path: string): void {
    const index = this.cacheAccessOrder.indexOf(path)
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1)
    }
    this.cacheAccessOrder.push(path)
    
    // Evict oldest entries if cache is too large
    while (this.cacheAccessOrder.length > FileHandler.MAX_CACHE_SIZE && this.cacheAccessOrder.length > 0) {
      const toEvict = this.cacheAccessOrder.shift()!
      this.evictFromCache(toEvict)
    }
  }

  /**
   * Remove path from cache access tracking
   * @param path the file path to remove
   */
  private removeFromCacheAccess(path: string): void {
    const index = this.cacheAccessOrder.indexOf(path)
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1)
    }
  }

  /**
   * Evict a file from all caches
   * @param path the file path to evict
   */
  private evictFromCache(path: string): void {
    const cached = this.filePathCache.get(path)
    if (cached) {
      this.filesCache.get(cached.type)?.delete(path)
      this.filePathCache.delete(path)
    }
  }
}

export default FileHandler
