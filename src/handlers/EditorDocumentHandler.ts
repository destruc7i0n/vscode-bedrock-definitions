import * as vscode from 'vscode'

import FileHandler from './FileHandler'
import Selection from '../lib/Selection'
import ResponseCache from '../lib/ResponseCache'
import { cleanJson } from '../lib/util'

import { FileType } from '../handlers/FileHandler'

class EditorDocumentHandler {
  private document: vscode.TextDocument

  public fileHandler: FileHandler
  public type: FileType = FileType.None
  public selection: Selection | null

  private cache: ResponseCache

  constructor (document: vscode.TextDocument, position: vscode.Position | null, cache: ResponseCache, hasSelection: boolean = true) {
    this.document = document

    this.selection = hasSelection && position ? new Selection(document, position) : null
    this.type = this.getDocumentType(document)

    this.cache = cache
    this.fileHandler = new FileHandler(this.cache)
  }

  public setSelectionType (type: FileType) {
    if (this.selection?.type) this.selection.setType(type)
  }

  /**
   * Returns the type of the current selection
   */
  public getSelectionType () {
    return this.selection?.type
  }

  /**
   * Returns the currently selected text
   */
  public getSelectionText () {
    return this.selection?.text
  }

  /**
   * Returns the range of the selection
   */
  public getSelectionRange () {
    return this.selection?.range
  }

  /**
   * Purges the cache of the current document type
   */
  public purgeCacheByDocumentType () {
    this.cache.purgeAllByType(this.type)
  }

  /**
   * Wrapper around the file searcher
   * @param type the type to search for
   * @param uri optional uri
   */
  public async findAllOfType (type: FileType, uri?: vscode.Uri) {
    return await this.fileHandler.findByType(type, uri)
  }

  /**
   * Returns all which match the selection type
   */
  public async getAllOfSelectionType () {
    const selectionType = this.getSelectionType()
    if (!selectionType) return
    return await this.findAllOfType(selectionType)
  }

  /**
   * Returns the defintion location of the current selection
   */
  public getDefinitionOfSelection () {
    const selectionType = this.getSelectionType()
    const selectionText = this.getSelectionText()
    if (!selectionType || !selectionText) return
    return this.fileHandler.findByIndentifier(selectionType, selectionText)
  }

  /**
   * Checks if the current document can be parsed based on selection
   */
  public shouldHandleSelection () {
    return this.selection
          && [FileType.ClientEntityIdentifier, FileType.ServerEntityIdentifier].includes(this.type)
          && this.selection.type !== FileType.None
  }

  /**
   * Checks if the document can be handled for command related stuff
   */
  public shouldHandleCommandCalls () {
    return [FileType.McFunction, FileType.Animation, FileType.AnimationController].includes(this.type)
  }

  /**
   * Returns whether or not the current document is a resource definition file
   */
  public isResourceDocument () {
    return ![FileType.None, FileType.McFunction].includes(this.type)
  }

  /**
   * Refresh the current document in the cache
   */
  public refreshCurrentDocument () {
    this.fileHandler.findByType(this.type, this.document.uri, true)
  }

  /**
   * Determines the file type of the JSON file specified
   */
  private getDocumentType (document: vscode.TextDocument) {
    let type: FileType = FileType.None
    // check that in client file, to not perform on the definition itself
    if (document.fileName.endsWith('.json')) {
      const content = cleanJson(document.getText())

      if (!content) return type

      const keys = Object.keys(content)
      // this is not a minecraft document
      if (!keys.includes('format_version')) return type
  
      const pathRoots: { [key: string]: FileType } = {
        'minecraft:client_entity': FileType.ClientEntityIdentifier,
        'minecraft:entity': FileType.ServerEntityIdentifier,
        'minecraft:geometry': FileType.Geometry,
        'animations': FileType.Animation,
        'animation_controllers': FileType.AnimationController,
        'render_controllers': FileType.RenderController,
        'particle_effect': FileType.Particle,
        'sound_definitions': FileType.SoundEffect,
      }

      for (let pathRoot of Object.keys(pathRoots)) {
        if (keys.includes(pathRoot)) {
          type = pathRoots[pathRoot]
        }
      }
  
      if (type === FileType.None) {
        const isOlderGeometry = keys.some((k) => k.startsWith('geometry.'))
        if (isOlderGeometry) type = FileType.Geometry
      }
    } else if (document.fileName.endsWith('.mcfunction')) type = FileType.McFunction

    return type
  }
}

export default EditorDocumentHandler
