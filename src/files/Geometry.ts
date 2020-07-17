import * as vscode from 'vscode'

import { Node } from 'jsonc-parser'

import { FilesSearchResponse, FileType } from '../handlers/FileHandler'
import { ResourceFile } from './ResourceFile'

class GeometryFile extends ResourceFile {
  type = FileType.Geometry
  glob = `**/models/**/*.json`

  extract (document: vscode.TextDocument, node: Node, content: any) {
    let response: FilesSearchResponse = { files: [], identifiers: [] }

    const formatVersion = content['format_version']
    if (formatVersion) {
      const versionParts = formatVersion.split('.')
      const release = Number(versionParts[1])

      if (release) {
        if (release < 12) {
          for (let geometry of Object.keys(content)) {
            if (geometry.startsWith('geometry.')) {
              let path = [ geometry ]

              const fileData = this.getFileData(node, path, document, geometry)
              if (fileData) {
                response.files.push(fileData)
                response.identifiers.push(geometry)
              }
            }
          }
        } else {
          // 1.12.0+ format
          if (content['minecraft:geometry']) {
            const documentGeometries = content['minecraft:geometry']
            for (let i = 0; i < documentGeometries.length; i++) {
              const geometry = documentGeometries[i]
              const identifier = this.verifyDescriptionIdentifier(geometry)
              if (identifier) {
                let path = [ 'minecraft:geometry', i ]

                const fileData = this.getFileData(node, path, document, geometry,)
                if (fileData) {
                  response.files.push(fileData)
                  response.identifiers.push(identifier)
                }
              }
            }
          }
        }
      }
    }

    return response
  }
}

export default GeometryFile
