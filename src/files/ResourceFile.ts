import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { FileType, Data, DataTypeMap, DataType } from '../handlers/FileHandler'

import { getAndParseFileContents, getOrderedFilesFromGlob } from '../lib/files'

export interface BaseFile {
  format_version: string
}

export interface DescriptionObject {
  description: {
    identifier: string
  }
}

export abstract class ResourceFile {
  public abstract type: FileType
  public static title: string
  public static glob: string

  public uri: vscode.Uri

  public data: DataTypeMap = new Map()

  constructor (uri: vscode.Uri) {
    this.uri = uri
  }

  public async extract () {
    const { node, data, document } = await getAndParseFileContents(this.uri)
    if (node && data) {
      this.extractData(document, node, data)
    }
  }

  protected extractData (document: vscode.TextDocument, node: Node, content: any) {
    this.data.set(DataType.Definition, this.extractIdentifiers(document, node, content))
  }

  protected abstract extractIdentifiers(document: vscode.TextDocument, node: Node, content: any): Data

  public static async *getGlobGenerator () {
    const files = await getOrderedFilesFromGlob(this.glob)
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