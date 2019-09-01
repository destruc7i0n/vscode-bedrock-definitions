import * as vscode from 'vscode'

import DefinitionProvider from './DefinitionProvider'

export function activate(context: vscode.ExtensionContext) {
  const definitionProvider = new DefinitionProvider()
  // const declarationProvider = new DeclarationProvider()

  console.log('Congratulations, your extension "vscode-bedrock-definitions" is now active!')

  // let disposableDeclaration = vscode.languages.registerDeclarationProvider({ scheme: 'file', language: 'json' }, declarationProvider)
  let disposableDefinition = vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'json' }, definitionProvider)

  context.subscriptions.push(disposableDefinition)
}

export function deactivate() {}
