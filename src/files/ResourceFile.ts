import * as path from 'path'

import * as vscode from 'vscode'

import { findNodeAtLocation, Node, parse, parseTree } from 'jsonc-parser'

import { FileType, FileData, FilesSearchResponse } from '../handlers/FileHandler'
import { nodeToRange } from '../lib/util'

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
  protected abstract glob: string

  protected abstract extract(document: vscode.TextDocument, node: Node, content: any): FilesSearchResponse

  public async extractFromAllFiles (): Promise<FilesSearchResponse> {
    const files = await this.getFilesFromGlob(this.glob)

    let filesData: FileData[] = []
    let filesIdentifiers: string[] = []

    for (let file of files) {
      const extracted = await this.extractFromFile(file)
      filesData.push(...extracted.files)
      filesIdentifiers.push(...extracted.identifiers)
    }

    return {
      files: filesData,
      identifiers: filesIdentifiers
    }
  }

  public async extractFromFile (uri: vscode.Uri): Promise<FilesSearchResponse> {
    const { node, data, document } = await this.getAndParseFileContents(uri)
    if (node && data) {
      return this.extract(document, node, data)
    }
    return { files: [], identifiers: [] }
  }

  protected getFileData (node: Node, path: (string | number)[], document: vscode.TextDocument, name: string): FileData | undefined {
    const pointer = findNodeAtLocation(node, path)
    if (pointer) {
      return {
        uri: document.uri,
        name,
        range: nodeToRange(pointer, document)
      }
    }
  }

  /**
   * Verify that there is a description and identifier on an object
   * @param description The description object to verify
   */
  protected verifyDescriptionIdentifier (description: DescriptionObject) {
    return description['description'] && description['description']['identifier']
  }

  /**
   * Open and parse (with source-maps) the file specified
   * @param file the file to parse
   */
  protected async getAndParseFileContents (file: vscode.Uri): Promise<{node: Node | null, data: any, document: vscode.TextDocument}> {
    const document = await vscode.workspace.openTextDocument(file)
    const textContent = document.getText()

    try {
      return {
        document,
        data: parse(textContent),
        node: parseTree(textContent)
      }
    } catch (e) {
      return {
        document,
        data: null,
        node: null
      }
    }
  } 

  /**
   * Orders the provided files by the distance from the current active file
   * @param files the files to order
   */
  private orderByDistance (files: vscode.Uri[]): vscode.Uri[] {
    if (vscode.window.activeTextEditor?.document) {
      const document = vscode.window.activeTextEditor.document
      const currentFile = document.fileName
      const sortedFiles = files.sort(({ path: aPath }, { path: bPath }) => {
        // get the closest file basded on the relative location of it and order
        const relativeToA = path.relative(currentFile, aPath).split(path.sep)
        const relativeToB = path.relative(currentFile, bPath).split(path.sep)
        return relativeToA.length - relativeToB.length
      })
      return sortedFiles
    }
    return files
  }

  /**
   * Get and order the files from the glob pattern provided
   * @param glob the glob to find files from
   */
  private async getFilesFromGlob (glob: vscode.GlobPattern): Promise<vscode.Uri[]> {
    return this.orderByDistance(await vscode.workspace.findFiles(glob))
  }
}