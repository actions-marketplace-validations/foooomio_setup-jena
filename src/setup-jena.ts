import fetch from 'node-fetch';
import compareVersions from 'compare-versions';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import path from 'path';

async function getLatestVersion(): Promise<string> {
  const url = 'https://projects.apache.org/json/foundation/releases.json';
  const response = await fetch(url + '?' + Math.random());

  if (!response.ok) {
    throw new Error(
      `Couldn't get releases.json: ${response.status} ${response.statusText}`
    );
  }

  type Json = Record<string, Record<string, string>>;
  const { jena } = (await response.json()) as Json;

  if (!jena) {
    throw new Error('"jena" not found in releases.json');
  }

  const versions: string[] = [];

  for (const key of Object.keys(jena)) {
    const [, version] = key.match(/jena-(\d+\.\d+\.\d+)/) || [];
    if (version) {
      versions.push(version);
    }
  }

  const [latest] = versions.sort((a, b) => compareVersions(a, b) * -1);

  if (!latest) {
    throw new Error(`Couldn't get the latest version: ${JSON.stringify(jena)}`);
  }

  return latest;
}

async function installJena(version: string): Promise<string> {
  const downloadUrl = `https://archive.apache.org/dist/jena/binaries/apache-jena-${version}.tar.gz`;

  const archivePath = await tc.downloadTool(downloadUrl);
  const flags = ['xz', '--strip=1'];
  const extractedPath = await tc.extractTar(archivePath, undefined, flags);
  const cachedPath = await tc.cacheDir(extractedPath, 'jena', version);

  return cachedPath;
}

async function run(): Promise<void> {
  let version = core.getInput('jena-version');
  if (!version || version === 'latest') {
    version = await getLatestVersion();
  }

  let jenaPath = tc.find('jena', version);
  if (!jenaPath) {
    jenaPath = await installJena(version);
  }

  core.exportVariable('JENA_HOME', jenaPath);
  core.addPath(path.join(jenaPath, 'bin'));
}

run().catch((e: Error) => {
  core.setFailed(e.message);
});
