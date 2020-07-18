import * as vscode from 'vscode'

import { AnimationControllerFile, AnimationFile, ClientEntityDefinitionFile, GeometryFile, MaterialFile, ParticleFile, RenderControllerFile, ServerEntityDefinitionFile, SoundEffectFile } from '../files'

import ResponseCache from '../lib/ResponseCache'

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

export type FileData = {
  uri: vscode.Uri
  name: string
  range: vscode.Range
}

export type FilesSearchResponse = {
  files: FileData[]
  identifiers: string[]
}

class FileHandler {
  private cache: ResponseCache

  constructor (cache: ResponseCache) {
    this.cache = cache
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

  /**
   * Get the identifiers from files following the same style
   * @param type the type of file to get the identifiers from
   */
  private async getByFileType (type: FileType, uri?: vscode.Uri): Promise<FilesSearchResponse> {
    let file = this.getFileHandler(type)
    if (file) {
      if (!uri)
        return await file.extractFromAllFiles()
      else
        return await file.extractFromFile(uri)
    }
    return { files: [], identifiers: [] }
  }

  /**
   * Returns all identifiers of a type specified
   * @param type the type to find
   */
  public async findByType (type: FileType, uri?: vscode.Uri, overwrite?: boolean) {
    let files: FilesSearchResponse = { files: [], identifiers: [] }

    switch (type) {
      case FileType.ServerEntityIdentifier:
      case FileType.ClientEntityIdentifier:
      case FileType.SoundEffect:
      case FileType.Geometry:
      case FileType.Particle:
      case FileType.Animation:
      case FileType.AnimationController:
      case FileType.Material:
      case FileType.RenderController: {
        files = await this.cache.setOrGetFromCache(
          type, 
          async () => this.getByFileType(type, uri),
          uri,
          overwrite,
        )
        break
      }
      default: break
    }

    return files
  }

  /**
   * Find a specific identifier
   * @param type the type to search
   * @param identifier the specific id
   */
  public async findByIndentifier (type: FileType, identifier: string) {
    const { files, identifiers } = await this.findByType(type)
  
    // model and materials may be parented etc
    if ((type === FileType.Material || type === FileType.Geometry) && !identifiers.includes(identifier)) {
      const id = identifiers.find(key => key.startsWith(`${identifier}:`))
      if (id) identifier = id
    }
  
    const identifierIndex = identifiers.indexOf(identifier)
    if (identifierIndex > -1) return files[identifierIndex]
    return null
  }

  /**
   * Get a texture from the string specified
   * @param path the path from which to get the texture from
   */
  public async getTexture (path: string): Promise<FileData | undefined> {
    const textures = await vscode.workspace.findFiles(`**/${path}.{png,tga}`)

    if (textures) {
      if (textures[0]) {
        return {
          uri: textures[0],
          name: path,
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
        }
      }
    }
  }
}

export default FileHandler
