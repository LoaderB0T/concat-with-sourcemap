import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';

import { SourceMapGenerator, SourceMapConsumer } from 'source-map';

import { unixStylePath } from './utils/unix-style-path';

const separator = '\n';

export class ConcatWithSourcemap {
  private readonly _bundleName: string;
  private readonly _bundleMapName: string;
  private readonly _sourceMap: SourceMapGenerator;

  private _lineOffset: number = 0;
  private _fileContent: string = '';

  constructor(bundleName: string) {
    this._bundleName = bundleName;
    this._bundleMapName = `${bundleName}.map`;
    this._sourceMap = new SourceMapGenerator({ file: unixStylePath(bundleName) });
  }

  public async addDirectory(dirPath: string) {
    const jsFiles = (await readdir(dirPath)).filter(
      x => x.endsWith('.js') && !x.endsWith(this._bundleName)
    );

    // Order is important
    for (const jsFile of jsFiles) {
      await this.addFile(join(dirPath, jsFile));
    }
  }

  public async addFile(filePath: string) {
    const mapFileName = `${filePath}.map`;
    const fileContent = await readFile(filePath, 'utf8');
    const sourceMapContent = (await stat(mapFileName)
      .then(s => s.isFile())
      .catch(() => false))
      ? await readFile(mapFileName, 'utf8')
      : undefined;
    const unixPath = unixStylePath(filePath);
    await this.add(unixPath, fileContent, sourceMapContent);
  }

  /**
   * Saves the current file content
   * @param filePath The file path to save to
   */
  public async saveContent(filePath: string) {
    await writeFile(filePath, this.content, 'utf8');
  }

  /**
   * Saves the current sourcemap
   * @param filePath The file path to save to
   */
  public async saveMap(filePath: string): Promise<void> {
    await writeFile(filePath, this.sourceMap, 'utf8');
  }

  /**
   * Saves the current file content and sourcemap
   * @param outputDir The directory to save the files to
   */
  public async saveFiles(outputDir: string) {
    await this.saveContent(join(outputDir, this._bundleName));
    await this.saveMap(join(outputDir, this._bundleMapName));
  }

  public async add(filePath: string | null, content: string, sourceMap?: string) {
    if (this._fileContent.length !== 0) {
      this._fileContent += separator;
    }

    // Remove sourceMappingURL from the content
    this._fileContent += content.replace(/^\/\/# sourceMappingURL=.*$/m, '');

    const lineCount = content.split('\n').length;

    const parsedSourceMap = sourceMap ? JSON.parse(sourceMap) : undefined;

    if (parsedSourceMap) {
      await this.addWithSourceMap(parsedSourceMap);
    } else if (filePath) {
      this.addWithoutSourceMap(filePath, lineCount);
    }
    this._lineOffset += lineCount;
  }

  private addWithoutSourceMap(filePath: string, lines: number) {
    for (let i = 1; i <= lines; i++) {
      this._sourceMap.addMapping({
        generated: {
          line: this._lineOffset + i,
          column: 0,
        },
        original: {
          line: i,
          column: 0,
        },
        source: filePath,
      });
    }
  }

  private async addWithSourceMap(parsedSourceMap: any) {
    const upstreamSM = await new SourceMapConsumer(parsedSourceMap);
    upstreamSM.eachMapping(mapping => {
      if (mapping.source === null) {
        return;
      }
      this._sourceMap.addMapping({
        generated: {
          line: this._lineOffset + mapping.generatedLine,
          column: mapping.generatedColumn,
        },
        original: {
          line: mapping.originalLine,
          column: mapping.originalColumn,
        },
        source: mapping.source,
        name: mapping.name,
      });
    });
    if (upstreamSM.sourcesContent) {
      upstreamSM.sourcesContent.forEach((sourceContent, i) => {
        this._sourceMap.setSourceContent(upstreamSM.sources[i], sourceContent);
      });
    }
  }

  public get content() {
    return `${this._fileContent}\n//# sourceMappingURL=${this._bundleMapName}`;
  }

  public get sourceMap() {
    return this._sourceMap.toString();
  }
}
