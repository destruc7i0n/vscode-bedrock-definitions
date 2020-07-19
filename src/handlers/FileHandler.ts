import * as vscode from 'vscode'

import { Mutex } from 'async-mutex'

import {
  AnimationControllerFile,
  AnimationFile,
  ClientEntityDefinitionFile,
  GeometryFile,
  MaterialFile,
  ParticleFile,
  RenderControllerFile,
  ServerEntityDefinitionFile,
  SoundEffectFile
} from '../files'

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

  McFunction,
}

export enum BehaviourDefinitionType {
  Events,
  ComponentGroups,
}

export type LocationData = { uri: vscode.Uri, range: vscode.Range }
export type DefinitionLocation = Map<string, LocationData>

export enum DataType {
  Definition,
}

// each type to the files it has
export type FilesData = Map<FileType, FileData>
// the string path to the types of data in the file
export type FileData = Map<string, DataTypeMap>
// the types of data to the data amp
export type DataTypeMap = Map<DataType, Data>
// the data ids to the data
export type Data<T = RangeInfo> = Map<string, T>
export type RangeInfo = { range: vscode.Range }

class FileHandler {
  private filesCache: FilesData = new Map()
  private bulkMutex: { [key in FileType]?: Mutex } = {}

  /**
   * Empty the file cache
   */
  public emptyCache () {
    this.filesCache.clear()
  }

  /**
   * Returns a handler based on the file type provided
   * @param type the type of handler to get
   */
  public getFileHandler (type: FileType) {
    let file

    switch (type) {
      case FileType.Geometry: {
        file = new GeometryFile()
        break
      }
      case FileType.Particle: {
        file = new ParticleFile()
        break
      }
      case FileType.Material: {
        file = new MaterialFile()
        break
      }
      case FileType.Animation: {
        file = new AnimationFile()
        break
      }
      case FileType.AnimationController: {
        file = new AnimationControllerFile()
        break
      }
      case FileType.RenderController: {
        file = new RenderControllerFile()
        break
      }
      case FileType.ServerEntityIdentifier: {
        file = new ServerEntityDefinitionFile()
        break
      }
      case FileType.ClientEntityIdentifier: {
        file = new ClientEntityDefinitionFile()
        break
      }
      case FileType.SoundEffect: {
        file = new SoundEffectFile()
        break
      }
      default: break
    }

    return file
  }

  public async refreshCacheForFile (file: vscode.Uri) {
    const path = file.path
    for (let [ type, files ] of this.filesCache) {
      if (files.has(path)) {
        const handler = this.getFileHandler(type)
        if (handler) {
          files.set(path, await handler.extractFromFile(file))
          break
        }
      }
    }
  }

  private async conditionallyGetByType (type: FileType) {
    if (!this.filesCache.has(type)) this.filesCache.set(type, new Map())

    const typeMap = this.filesCache.get(type)!
    const handler = this.getFileHandler(type)
    if (handler) {
      const gen = handler.getGlobGenerator()

      // show progress while getting all the files
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: `Updating Bedrock Definitions for "${handler.title}"...`
      }, async () => {
        for await (let file of gen) {
          if (!typeMap.has(file.path))
            typeMap.set(file.path, await handler.extractFromFile(file))
        }
      })
    }
  }

  /**
   * Get a mutex for each type
   * @param type the type to get the mutex for
   */
  private async getMutexForType (type: FileType) {
    if (!this.bulkMutex[type]) this.bulkMutex[type] = new Mutex()
    return await this.bulkMutex[type]!.acquire()
  }

  public async getAllByType (type: FileType) {
    // use a mutex to only run one bulk get a time
    const release = await this.getMutexForType(type)

    if (!this.filesCache.has(type)) {
      await this.conditionallyGetByType(type)
    }

    release()
    return this.filesCache.get(type)!
  }

  public async getAllOfTypeByDataType (type: FileType, dataType: DataType) {
    let map: DefinitionLocation = new Map()

    const fileData = await this.getAllByType(type)
    for (let [ file, dataMap ] of fileData) {
      const data = dataMap.get(dataType)
      if (data) {
        for (let [ id, info ] of data) {
          map.set(id, {
            range: info.range,
            uri: vscode.Uri.file(file)
          })
        }
      }
    }

    return map
  }

  /**
   * Returns all identifiers of a type specified
   * @param type the type to find
   */
  public async getIdentifiersByFileType (type: FileType) {
    return await this.getAllOfTypeByDataType(type, DataType.Definition)
  }

  /**
   * Find a specific identifier
   * @param type the type to search
   * @param identifier the specific id
   */
  public async findByIndentifier (type: FileType, identifier: string) {
    const data = await this.getIdentifiersByFileType(type)
    const identifiers = [ ...data.keys() ]
  
    // model and materials may be parented etc
    if ((type === FileType.Material || type === FileType.Geometry) && !identifiers.includes(identifier)) {
      const id = identifiers.find(key => key.startsWith(`${identifier}:`))
      if (id) identifier = id
    }
  
    if (data.has(identifier))
      return data.get(identifier)!
  }

  /**
   * Get a texture from the string specified
   * @param path the path from which to get the texture from
   */
  public async getTexture (path: string) {
    const textures = await vscode.workspace.findFiles(`**/${path}.{png,tga}`)

    if (textures && textures.length === 1)
      return textures[0]
  }
}

export default FileHandler
