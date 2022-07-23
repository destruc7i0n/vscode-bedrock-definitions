import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { FileType, Data, DataTypeMap, DataType, ResourceFilePackType } from '../../handlers/FileHandler'

import { getAndParseFileContents } from '../../lib/files'
import { guessPackTypeFromDocument } from '../../lib/util'

export interface BaseFile {
  format_version: string
}

export interface DescriptionObject {
  description: {
    identifier: string
  }
}

export abstract class ResourceFile {
  /**
   * The file type, such as an entity definition
   */
  public abstract type: FileType
  /**
   * The human readable title of this file, such as "Animation"
   */
  public static title: string
  /**
   * The glob to search for files of this type
   */
  public static glob: string

  /**
   * The URI of this file, provided by vscode
   */
  public uri: vscode.Uri

  /**
   * What pack type this file was found in
   */
  public packType: ResourceFilePackType = ResourceFilePackType.Unknown

  /**
   * The data that this file contains
   */
  public data: DataTypeMap = new Map()

  constructor (uri: vscode.Uri) {
    this.uri = uri
  }

  /**
   * Returns the data from this file of the type specified
   * @param type 
   */
  public get (type: DataType) {
    return this.data.get(type)
  }

  /**
   * Extract all types of data from this file
   */
  public async extract () {
    const { node, data, document } = await getAndParseFileContents(this.uri)

    this.packType = guessPackTypeFromDocument(document)

    if (node && data) {
      this.extractData(document, node, data)
    }
  }

  /**
   * Method to run extractors for this file
   * @param document 
   * @param node 
   * @param content 
   */
  protected extractData (document: vscode.TextDocument, node: Node, content: any) {
    this.data.set(DataType.Definition, this.extractIdentifiers(document, node, content))
  }

  protected abstract extractIdentifiers(document: vscode.TextDocument, node: Node, content: any): Data

  /**
   * Get an async generator for each file of the glob
   */
  public static async *getGlobGenerator () {
    // const files = await getOrderedFilesFromGlob(this.glob)
    const files = await vscode.workspace.findFiles(this.glob)
    for (let file of files) {
      yield file
    }
  }

  /**
   * Verify that there is a description and identifier on an object
   * @param description The description object to verify
   */
  protected verifyDescriptionIdentifier (description: DescriptionObject) {
    return description['description'] && description['description']['identifier']
  }
}