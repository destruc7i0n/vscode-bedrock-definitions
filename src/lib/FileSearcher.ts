import * as vscode from 'vscode'

import FileHandler, { FilesSearchResponse, FileType } from '../handlers/FileHandler'

import ResponseCache from './ResponseCache'

class FileSearcher {
  private cache: ResponseCache

  public fileHandler: FileHandler

  constructor (document: vscode.TextDocument, cache: ResponseCache) {
    this.cache = cache

    this.fileHandler = new FileHandler(document)
  }

  /**
   * Returns all identifiers of a type specified
   * @param type the type to find
   */
  public async findByType (type: FileType) {
    let files: FilesSearchResponse = { files: [], identifiers: [] }

    switch (type) {
      case FileType.Particle: {
        files = await this.cache.setOrGetFromCache(
          type, 
          () => this.fileHandler.getParticles()
        )
        break
      }
      case FileType.ServerEntityIdentifier:
      case FileType.ClientEntityIdentifier: {
        files = await this.cache.setOrGetFromCache(
          type,
          () => this.fileHandler.getEntities(type)
        )
        break
      }
      case FileType.SoundEffect: {
        files = await this.cache.setOrGetFromCache(
          type, 
          () => this.fileHandler.getSoundDefinitions()
        )
        break
      }
      case FileType.Geometry: {
        files = await this.cache.setOrGetFromCache(
          type, 
          () => this.fileHandler.getGeometries()
        )
        break
      }
      case FileType.Animation:
      case FileType.AnimationController:
      case FileType.Material:
      case FileType.RenderController: {
        files = await this.cache.setOrGetFromCache(
          type, 
          () => this.fileHandler.getByFileType(type)
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
}

export default FileSearcher
