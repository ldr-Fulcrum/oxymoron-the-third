import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const localPython = fileURLToPath(new URL(
  process.platform === 'win32' ? '../../.venv/Scripts/python.exe' : '../../.venv/bin/python',
  import.meta.url,
));

function diagnostic(command, result) {
  return `${command}: ${result.error?.code ?? `exit ${result.status}`} ${result.stderr?.trim() || result.stdout?.trim() || result.signal || 'no output'}`;
}

/** Use a real Python 3 interpreter; never skip the independent oracle. */
export function runPython(args, env = process.env) {
  // An explicit override is authoritative: a typo must not silently select another runtime.
  const candidates = env.PYTHON
    ? [[env.PYTHON, []]]
    : [[localPython, []], ['python3', []], ['python', []], ['py', ['-3']]];
  const failures = [];
  for (const [command, prefix] of candidates) {
    const options = {encoding: 'utf8', timeout: 10000, windowsHide: true, env};
    const check = spawnSync(command, [...prefix, '-c',
      'import sys; print(sys.version); sys.exit(0 if sys.version_info.major == 3 else 1)'], options);
    if (check.error || check.status !== 0) {
      failures.push(diagnostic(command, check));
      continue;
    }
    const result = spawnSync(command, [...prefix, ...args], options);
    if (result.error || result.status !== 0) {
      throw new Error(`Python cross-check execution failed: ${diagnostic(command, result)}`);
    }
    return result.stdout;
  }
  throw new Error(`Python 3 is required; no working interpreter found. Set PYTHON to an executable path (not a shell command), or create .venv with Python 3.\n${failures.join('\n')}`);
}
