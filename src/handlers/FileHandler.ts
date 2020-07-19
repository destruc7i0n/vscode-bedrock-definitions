import * as vscode from 'vscode'

import { AnimationControllerFile, AnimationFile, ClientEntityDefinitionFile, GeometryFile, MaterialFile, ParticleFile, RenderControllerFile, ServerEntityDefinitionFile, SoundEffectFile } from '../files'

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

export type FilesData = Map<FileType, FileData>
export type FileData = Map<vscode.Uri, DataTypeMap>
export type DataTypeMap = Map<DataType, Data>
export type Data = Map<string, DataInfo>
export type DataInfo = { range: vscode.Range }

class FileHandler {
  private filesCache: FilesData = new Map()

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
    for (let [ type, files ] of this.filesCache) {
      if (files.has(file)) {
        const handler = this.getFileHandler(type)
        if (handler)
          files.set(file, await handler.extractFromFile(file))
      }
    }
  }

  private async conditionallyGetByType (type: FileType) {
    this.filesCache.set(type, new Map())

    const typeMap = this.filesCache.get(type)!
    const handler = this.getFileHandler(type)
    if (handler) {
      const gen = handler.getGlobGenerator()

      for await (let file of gen) {
        if (!typeMap.has(file)) {
          typeMap.set(file, await handler.extractFromFile(file))
        }
      }
    }
  }

  public async getAllByType (type: FileType) {
    if (!this.filesCache.has(type)) {
      await this.conditionallyGetByType(type)
    }
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
            uri: file
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
  
    if (data.has(identifier)) {
      return data.get(identifier)!
    }
  }

  /**
   * Get a texture from the string specified
   * @param path the path from which to get the texture from
   */
  public async getTexture (path: string) {
    const textures = await vscode.workspace.findFiles(`**/${path}.{png,tga}`)

    if (textures && textures.length === 1) {
      return textures[0]
    }
  }
}

export default FileHandler
