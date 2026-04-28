const { src, dest } = require('gulp');

/**
 * Copy SVG / PNG icons from the source tree into dist/ during build.
 * n8n loads node icons via `file:<icon>` paths relative to the compiled .node.js file.
 */
function buildIcons() {
	return src('nodes/**/*.{png,svg}').pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
