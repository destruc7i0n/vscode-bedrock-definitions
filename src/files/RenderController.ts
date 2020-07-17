import { FileType } from '../handlers/FileHandler'

import KeyBasedFile from './KeyBasedFile'

class RenderControllerFile extends KeyBasedFile {
  type = FileType.RenderController
  root = 'render_controllers'
  glob = `**/render_controllers/**/*.json`
}

export default RenderControllerFile
