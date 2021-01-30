'use strict';

const cp = require('child_process');
const path = require('path')
const Package = require('@aotu-cli/package')
const log = require('@aotu-cli/log')

const SETTINGS = {
    init: '@imooc-cli/init',
};

const CACHE_DIR = 'dependencies';

async function exec() {
    // 1. targetPath -> modulePath
    // 2. modulePath -> Package(npm 模块)
    // 3. Package.getRootFile (获取文件入口)

    let targetPath = process.env.CLI_TARGET_PATH;
    const homePath = process.env.CLI_HOME_PATH;
    let storeDir = ''
    let pkg
    log.verbose('targetPath', targetPath);
    log.verbose('homePath', homePath);

    const cmdObj = arguments[arguments.length - 1];
    const cmdName = cmdObj.name();
    const packageName = SETTINGS[cmdName];
    const packageVersion = 'latest';

    if (!targetPath) {
        targetPath = path.resolve(homePath, CACHE_DIR);
        storeDir = path.resolve(targetPath, 'node_modules')
        log.verbose('targetPath', targetPath);
        log.verbose('storeDir', storeDir)

        pkg = new Package({
            targetPath,
            packageName,
            packageVersion,
            storeDir
        })
        if (await pkg.exists()) {
            // 更新package
            await pkg.update()
        } else {
            // 安装package
            await pkg.install()
        }
    } else {
        pkg = new Package({
            targetPath,
            packageName,
            packageVersion,
        });
    }
    const rootFile = pkg.getRootFilePath();
    if (rootFile) {
        try {
            // 在当前进程中调用
            // require(rootFile).call(null, Array.from(arguments));
            const args = Array.from(arguments);
            const cmd = args[args.length - 1];
            const o = Object.create(null);
            Object.keys(cmd).forEach(key => {
                if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
                    o[key] = cmd[key];
                }
            });
            args[args.length - 1] = o;
            // 在node子进程中调用
            const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`;
            const child = spawn('node', ['-e', code], {
                cwd: process.cwd(),
                stdio: 'inherit',
            });
            child.on('error', e => {
                log.error(e.message);
                process.exit(1);
            });
            child.on('exit', e => {
                log.verbose('命令执行成功:' + e);
                process.exit(e);
            });
        } catch (e) {
            log.error(e.message);
        }
    }
}

function spawn(command, args, options) {
    const win32 = process.platform === 'win32';
    const cmd = win32 ? 'cmd' : command;
    const cmdArgs = win32 ? ['/c'].concat(command, args) : args;
    return cp.spawn(cmd, cmdArgs, options || {});
}

module.exports = exec;
