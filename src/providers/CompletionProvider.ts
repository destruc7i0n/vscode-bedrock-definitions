import * as vscode from 'vscode'

import * as path from 'path'

import FileHandler from '../lib/FileHandler'

import SharedProvider, { TextType, FileType } from './SharedProvider'

export default class BedrockCompletionProvider extends SharedProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    const fileHandler = new FileHandler(document)

    const editor = vscode.window.activeTextEditor
    if (!editor) return

    const { pathKeys } = this.getPathToCursor(document, position)

    // check that in client file, to not perform on the definition itself
    const { type } = this.getCurrentFileType(pathKeys)
    const isBehaviourFile = type === FileType.ServerDefinition
    const isClientFile = type === FileType.ClientDefinition

    // only perform in these files for now
    if (!isClientFile && !isBehaviourFile) return

    const { parent, key } = this.getParentAndKey(pathKeys)

    const { currText, currWordRange } = this.getCurrentText(document, position)

    if (currWordRange && currText) {
      const { type, isPointerText } = this.getCurrentTextType(currText, parent, key, pathKeys)

      const filterAndCompletion = (identifiers: Array<string>) =>
        identifiers
          .filter(i => i.startsWith(currText)) // starts with
          .filter((k, i, arr) => arr.indexOf(k) === i) // remove dupes
          .map(k => this.completionItem(k, currWordRange)) // convert to completion items

      if (isPointerText) {
        if (isClientFile) {
          if (type === TextType.ClientEntityIdentifier) {
            const { identifiers: entities } = await fileHandler.getEntities('server')
            return filterAndCompletion(entities)
          } else if (type === TextType.RenderController) {
            const { identifiers: renderControllers } = await fileHandler.getByFileType('render_controllers')
            return filterAndCompletion(renderControllers)
          } else if (type === TextType.Geometry) {
            let { identifiers: geometries } = await fileHandler.getGeometries()
            // remove the colons from parented models
            const removeParentedColonRegex = /(.*)\:.*/g
            geometries = geometries.map(geo => geo.match(removeParentedColonRegex)
              ? (removeParentedColonRegex.exec(geo) as Array<string>)[1]
              : geo
            )
            return filterAndCompletion(geometries)
          } else if (type === TextType.Particle) {
            const { identifiers: particles } = await fileHandler.getParticles()
            return filterAndCompletion(particles)
          } else if (type === TextType.Texture) {
            const textures = await this.handleTextures(document)
            return filterAndCompletion(textures)
          } else if (type === TextType.SoundEffect) {
            let { identifiers: soundEffects } = await fileHandler.getSoundDefinitions()
            return filterAndCompletion(soundEffects)
          }
        }

        if (isClientFile || isBehaviourFile) {
          if (type === TextType.Animation || type === TextType.AnimationController) {
            const folder = type === TextType.Animation ? 'animations' : 'animation_controllers'
            const { identifiers } = await fileHandler.getByFileType(folder)
            return filterAndCompletion(identifiers)
          }
        }
      }
    }
  }

  /**
   * Finds files following the texture path provided
   * @param document the document
   */
  private async handleTextures (document: vscode.TextDocument) {
    const textureFiles = await vscode.workspace.findFiles('**/textures/**/*.{png,tga}')

    let textures = []

    // get all the textures and get the path to it
    for (let textureFile of textureFiles) {
      const texturePath = textureFile.path
      const relativePath = path.relative(document.uri.path, texturePath)
      const pathParts = /^(.+\.\/)+(.*)\.(png|tga)$/g.exec(relativePath)

      if (pathParts && pathParts.length === 4) {
        const texturePath = pathParts[2]
        textures.push(texturePath)
      }
    }
    return textures
  }

  /**
   * Returns a modified completion item
   * @param text the text to complete
   * @param range the range to complete
   * @param description the description of the completion
   * @param insertText what to insert (if different from the text)
   */
  private completionItem (text: string, range: vscode.Range, description?: string, insertText?: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(text)
    item.kind = vscode.CompletionItemKind.Value
    item.detail = description
    item.insertText = insertText ? insertText : text
    item.range = range
    return item
  }
}