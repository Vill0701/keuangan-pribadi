import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Memberi versi unik pada cache service worker di setiap build, supaya cache lama dibersihkan. */
function serviceWorkerVersion(): Plugin {
  let outDir = 'dist'
  return {
    name: 'service-worker-version',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      writeFileSync(file, readFileSync(file, 'utf8').replace('__BUILD_VERSION__', Date.now().toString(36)))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Path relatif supaya bisa di-hosting di subfolder, misal GitHub Pages (username.github.io/nama-repo/).
  base: './',
  plugins: [react(), serviceWorkerVersion()],
})
