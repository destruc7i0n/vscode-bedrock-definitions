import { FileType } from '../handlers/FileHandler'

import DescriptionBasedFile from './DescriptionBasedFile'

class ClientEntityFile extends DescriptionBasedFile {
  type = FileType.ClientEntityIdentifier
  title = 'Client Entity'
  root = 'minecraft:client_entity'
  glob = `**/entity/**/*.json`
}

export default ClientEntityFile
