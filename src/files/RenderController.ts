import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class RenderControllerFile extends KeyBasedFile {
  type = FileType.RenderController
  title = 'Render Controller'
  root = 'render_controllers'
  glob = `**/render_controllers/**/*.json`
}

export default RenderControllerFile
