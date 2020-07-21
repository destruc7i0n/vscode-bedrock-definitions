import { basename } from 'path'

import * as vscode from 'vscode'

import FileHandler from './FileHandler'
import Selection from '../lib/Selection'
import { cleanJson } from '../lib/util'

import { FileType } from '../handlers/FileHandler'

interface DocumentMapping {
  [key: string]: FileType 
}

class EditorDocumentHandler {
  private document: vscode.TextDocument
  private fileHandler: FileHandler

  public type: FileType = FileType.None
  public selection: Selection | null

  constructor (document: vscode.TextDocument, position: vscode.Position | null, fileHandler: FileHandler, hasSelection: boolean = true) {
    this.document = document

    this.selection = hasSelection && position ? new Selection(document, position) : null
    this.type = this.getDocumentType(document)

    this.fileHandler = fileHandler
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
   * Wrapper around the file searcher
   * @param type the type to search for
   * @param uri optional uri
   */
  public async findAllIdentifiersOfType (type: FileType) {
    return await this.fileHandler.getIdentifiersByFileType(type)
  }

  /**
   * Returns all which match the selection type
   */
  public async getAllOfSelectionType () {
    const selectionType = this.getSelectionType()
    if (!selectionType) return
    return await this.findAllIdentifiersOfType(selectionType)
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
    this.fileHandler.refreshCacheForFile(this.document.uri)
  }

  /**
   * Determines the file type of the JSON file specified
   */
  private getDocumentType (document: vscode.TextDocument) {
    let type: FileType = FileType.None

    const fileName = basename(document.fileName)

    // check that in client file, to not perform on the definition itself
    if (fileName.endsWith('.json') || fileName.endsWith('.material')) {
      // don't use jsonc-parser to save time
      const content = cleanJson(document.getText())

      if (!content) return type

      const fileNameBasedAssoc: DocumentMapping = {
        'sound_definitions.json': FileType.SoundEffect,
      }
      
      const fileNameAssoc = fileNameBasedAssoc[fileName]
      if (fileNameAssoc) return fileNameAssoc

      const keys = Object.keys(content)
      // this is not a minecraft document
      if (keys.includes('format_version') || keys.includes('materials')) {
        const pathRoots: DocumentMapping = {
          'minecraft:client_entity': FileType.ClientEntityIdentifier,
          'minecraft:entity': FileType.ServerEntityIdentifier,
          'minecraft:block': FileType.Block,
          'minecraft:geometry': FileType.Geometry,
          'animations': FileType.Animation,
          'animation_controllers': FileType.AnimationController,
          'render_controllers': FileType.RenderController,
          'particle_effect': FileType.Particle,
          'sound_definitions': FileType.SoundEffect,
          'materials': FileType.Material,
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
      }
    } else if (fileName.endsWith('.mcfunction')) type = FileType.McFunction

    return type
  }
}

export default EditorDocumentHandler
