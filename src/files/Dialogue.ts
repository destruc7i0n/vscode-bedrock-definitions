import { Node } from 'jsonc-parser'
import * as vscode from 'vscode'

import { Data, FileType } from '../handlers/FileHandler'

import { ResourceFile } from './types/ResourceFile'

import { getRangeFromPath } from '../lib/util'

class DialogueFile extends ResourceFile {
  type = FileType.Dialogue
  static title = 'Dialogue'
  root = 'minecraft:npc_dialogue'
  static glob = `**/dialogue/**/*.json`

  constructor(uri: vscode.Uri) {
    super(uri)
  }

  /**
   * Extract identifiers of either key based or description based type
   * @param document 
   * @param node 
   * @param content 
   */
  extractIdentifiers(document: vscode.TextDocument, node: Node, content: any) {
    let response: Data = new Map()

    content = content[this.root!]

    const scenes = content?.scenes ?? []

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]

      const path = [this.root!, 'scenes', i]
      const tag = scene?.scene_tag

      if (tag) {
        const range = getRangeFromPath(node, path, document)
        if (range) {
          response.set(tag, { range })
        }
      }
    }

    console.log(response)

    return response
  }
}

export default DialogueFile
