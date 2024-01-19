function ChunkManifestPlugin(options) {
    this.PLUGIN_NAME = 'ChunkManifestPlugin';

    options = options || {};
    this.manifestFilename = options.filename || 'manifest.json';
    this.manifestVariable = options.manifestVariable || 'webpackManifest';
}

ChunkManifestPlugin.prototype = {
    constructor: ChunkManifestPlugin,

    apply(compiler) {
        const self = this;

        const { manifestFilename, manifestVariable } = self;

        const { RawSource } = compiler.webpack.sources;

        let oldChunkFilename;
        let chunkManifest;

        compiler.hooks.thisCompilation.tap(self.PLUGIN_NAME, compilation => {
            const { mainTemplate, outputOptions } = compilation;

            oldChunkFilename = outputOptions.chunkFilename;
            compilation.outputOptions.chunkFilename = '__CHUNK_MANIFEST__';

            mainTemplate.hooks.requireEnsure.tap(self.PLUGIN_NAME, (_, chunk, hash) => {
                const filename = outputOptions.chunkFilename || outputOptions.filename;
                if (filename) {
                    chunkManifest = [chunk].reduce(function registerChunk(manifest, c) {
                        if (c.id in manifest) {return manifest;}
                        manifest[c.id] = compilation.hooks.assetPath.call(filename, {
                            hash,
                            chunk: c
                        });
                        return [...compilation.chunks].reduce(registerChunk, manifest);
                    }, {});

                    // Mark as asset for emitting
                    compilation.assets[manifestFilename] = new RawSource(JSON.stringify(chunkManifest));
                    chunk.files.add(manifestFilename);
                }

                return _;
            });
        });

        compiler.hooks.compilation.tap(self.PLUGIN_NAME, compilation => {
            const { mainTemplate } = compilation;

            mainTemplate.hooks.requireEnsure.tap(self.PLUGIN_NAME, (_, chunk, hash, chunkIdVar) => {
                if (oldChunkFilename) {
                    compilation.outputOptions.chunkFilename = oldChunkFilename;
                }

                return _.replace('"__CHUNK_MANIFEST__"',
                    'window["' + manifestVariable + '"][' + chunkIdVar + ']').replace('jsonpScriptSrc(chunkId)',
                    '__webpack_require__.p + window["' + manifestVariable + '"][' + chunkIdVar + ']');
            });
        });
    }
};

module.exports = ChunkManifestPlugin;
