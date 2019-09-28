'use strict'
/*
 * Puppy DevTools
 **/

require('colors')
const _ = require('lodash')
const nodePersist = require('node-persist')

const META_DIR = `${__dirname}/meta`
const COMP_DIR = `${__dirname}/components`
const COMP_FILE = 'components.json'
const TYPES = ['core', 'api', 'ms1', 'ms2', 'sdk', 'ui', 'packages']

/*
 * add
 **/
const add = async () => {

    const gitAdd = path => new Promise((resolve, reject) => require('simple-git/promise')(path).add(['*']).then(() => resolve(true), err => reject(err)))
    
    const storage = await getStorage('cloned')
    const keys = await getClonedKeys()

    keys.forEach(async key => {
        const { path, name } = await storage.getItem(key)
        try {
            console.log(`Adding files in ${name}...`)
            await gitAdd(path)
            console.log(`Added files in ${name}`.green)
        } catch (err) {
            console.error(`Cannot add files in ${name}: ${err.message}`.red)
            throw err
        }
    })

}

/*
 * checkout
 * --branch=[branch_name]
 **/
const checkout = async args => {

    if (!args || !args.branch) {
        throw new Error('Branch missing. Provide with --branch=[branch_name]')
    }

    const gitCheckout = (path, branch) => new Promise((resolve, reject) => {
        require('simple-git')(path).silent(true).checkout(branch, err => {
            if (err) {
                if (_.startsWith(err, 'error: pathspec')) {
                    gitCheckout(path, ['-b', args.branch])
                    .then(
                        () => resolve(true), 
                        err => reject(err)
                    )
                } else {
                    reject(new Error(err))
                }
            }
            else {
                resolve(true)
            }
        })
    })

    const storage = await getStorage('cloned')
    const keys = await getClonedKeys()

    keys.forEach(async key => {
        const { path, name } = await storage.getItem(key)
        try {
            console.log(`Switching ${name} to ${args.branch}...`)
            await gitCheckout(path, args.branch)
            console.log(`Switched ${name} to ${args.branch}`.green)
        } catch (err) {
            console.error(`Cannot switch ${name} to ${args.branch}: ${err.message}`.red)
            throw err
        }
    })

}

/*
 * clone
 * --type=[ api | ms1 | ms2 | sdk | ui ]
 **/ 
const clone = async args => {

    let all = true

    if (args && args.type) { 
        if (TYPES.indexOf(args.type) === -1) {
            throw new Error(`Invalid type. Pass with --type=[ ${TYPES.join(' | ')} ]`)
        }
        all = false
    }

    console.log(`Cloning ${ all ? 'all' : args.type } components...`)

    const gitClone = (repo, path) => new Promise((resolve, reject) => {
        require('simple-git/promise')()
            .silent(true)
            .clone(repo, path)
            .then(() => resolve(true))
            .catch(err => reject(err))
    })
    
    let components = require(`./${COMP_FILE}`)
    
    if (args && args.type) { 
        const filtered = _.filter(components, (_item, key) => key === args.type)[0]
        components = { [args.type]: filtered }
    }

    const storage = await getStorage('cloned')
    const keys = await getClonedKeys()

    for (let component_type in components) {

        const path = `${COMP_DIR}/${component_type}`
        require('mkdirp').sync(path)
        
        for (let component_code in components[component_type]) {
        
            const component = components[component_type][component_code]
        
            if (keys.indexOf(component_code) === -1) {

                try {
                
                    console.log(`Cloning ${component_type}/${component.name}...`)
                
                    await gitClone(component.repo, `${path}/${component.name}`)
                    await storage.setItem(component_code, {
                        name: `${component_type}/${component.name}`,
                        path: `${path}/${component.name}`
                    })
                
                    console.log(`Cloned ${component_type}/${component.name}`.green)
                
                } catch (err) {
                    console.error(`Cannot clone ${component_type}/${component.name}: ${err.message}`.red)
                }

            } else {
                console.log(`Skipping ${component_type}/${component.name}`.yellow)
            }
        }

    }

    console.log('Components cloned'.bold.green)

}

/*
 * cloned
 **/
const cloned = async () => (await getClonedKeys()).forEach(key => console.log(`- ${key}`))

/*
 * commit
 **/
const commit = async () => {

    const prompts = require('prompts')

    const { message } = await prompts({
        type: 'text',
        name: 'message',
        message: 'Commit Message: ',
    })

    const gitCommit = path => new Promise((resolve, reject) => require('simple-git/promise')(path).commit(message).then(() => resolve(true), err => reject(err)))

    const storage = await getStorage('cloned')
    const keys = await getClonedKeys()

    keys.forEach(async key => {
        const { path, name } = await storage.getItem(key)
        try {
            console.log(`Committing files in ${name}...`)
            await gitCommit(path)
            console.log(`Committed files in ${name}`.green)
        } catch (err) {
            console.error(`Cannot commit files in ${name}: ${err.message}`.red)
            throw err
        }
    })

}

/*
 * pull
 **/
const pull = async () => {

    const gitPull = path => new Promise((resolve, reject) => require('simple-git/promise')(path).pull().then(() => resolve(true), err => reject(err)))
    
    const storage = await getStorage('cloned')
    const keys = await getClonedKeys()

    keys.forEach(async key => {
        const { path, name } = await storage.getItem(key)
        try {
            console.log(`Pulling ${name}...`)
            await gitPull(path)
            console.log(`Pulled ${name}`.green)
        } catch (err) {
            console.error(`Cannot pull ${name}: ${err.message}`.red)
            throw err
        }
    })

}

/*
 * push
 **/
const push = async () => {

    const gitPush = path => new Promise((resolve, reject) => {
        require('simple-git/promise')(path).branch()
        .then(
            branch => {
                if (branch.current) {
                    return require('simple-git/promise')(path).push('origin', branch.current)
                } else {
                    resolve(true)
                }
            },
            err => { throw err }
        )
        .then(
            () => resolve(true),
            err => { throw err }
        )
        .catch(err => reject(err))
    })
    
    const storage = await getStorage('cloned')
    const keys = await getClonedKeys()

    keys.forEach(async key => {
        const { path, name } = await storage.getItem(key)
        try {
            console.log(`Pushing ${name}...`)
            await gitPush(path)
            console.log(`Pushed ${name}`.green)
        } catch (err) {
            console.error(`Cannot push ${name}: ${err.message}`.red)
            throw err
        }
    })

}

/*
 * remove
 **/ 
const remove = async () => {

    console.log('Removing components...')

    require('rimraf').sync(COMP_DIR)
    require('rimraf').sync(META_DIR)

    console.log('Components removed'.bold.green)

}

/*
 * status
 **/ 
const status = async () => {

    const gitStatus = (path, name) => new Promise((resolve, reject) => {
        require('simple-git')(path).status((err, status)=> {
            if (err) { 
                reject(new Error(err))
            }
            else {

                console.log('')
                console.log(`${name}`.bold.underline.cyan, `(${status.tracking})`.cyan)
                
                if (status.ahead > 0) {
                    console.log(`* Ahead by ${status.ahead} commit(s)`.bold.green)
                }
                if (status.behind > 0) {
                    console.log(`* Behind by ${status.behind} commit(s)`.bold.red) 
                }

                const operations = {
                    not_added: { label: 'Not Added:', color: 'red' },
                    conflicted: { label: 'Conflicted:', color: 'yellow' },
                    created: { label: 'Created:', color: 'green' },
                    deleted: { label: 'Deleted:', color: 'red' },
                    modified: { label: 'Modified:', color: 'green' },
                    renamed: { label: 'Renamed:', color: 'green' },
                    staged: { label: 'Staged:', color: 'green' }
                }

                let no_changes = true

                for (let operation in operations) {
                    if (status[operation].length) {
                        console.log(operations[operation].label.bold.white)
                        status[operation].forEach(file => console.log(`  - ${file}`[operations[operation].color]))
                        no_changes = false
                    }
                }

                no_changes && console.log('No changes'.gray)

                resolve(true)

            }
        })
    })

    const storage = await getStorage('cloned')
    const keys = await getClonedKeys()

    keys.forEach(async key => {
        const { path, name } = await storage.getItem(key)
        try {
            await gitStatus(path, name)
        } catch (err) {
            throw err
        }
    })

}

/*
 * Utilities
 **/

const getStorage = async namespace => {
    const storage = await nodePersist.create({ dir: `${META_DIR}/${namespace}` })
    await storage.init()
    return storage
}

const getClonedKeys = async () => {
    const storage = await getStorage('cloned')
    const keys = (await storage.keys()).sort()
    return keys
}

/*
 * Entry Point
 **/ 
const commands = {
    add,
    checkout,
    clone,
    cloned,
    commit,
    pull,
    push,
    remove,
    status
}

const availableCommands = []

for (let command in commands) {
    availableCommands.push(command)
}

if (!process.argv[2]) {

    console.log('Available commands:'.bold.white)
    console.log(availableCommands.join(', ').yellow)

} else {

    if (availableCommands.indexOf(process.argv[2]) === -1) {
        
        console.log(`Unknown command: ${process.argv[2]}`.bold.red)

        console.log('Available commands:'.bold.white)
        console.log(availableCommands.join(', ').yellow)

    } else {

        const len = process.argv.length
        
        if (len > 3) {
        
            const args = {}
        
            for (let i = 3; i < len; i++) {
                if (_.startsWith(process.argv[i], '--')) {
                    const exp = process.argv[i].replace('--', '').split('=')
                    const key = exp[0]
                    const value = exp[1]
                    args[key] = value
                }
            }        
        
            commands[process.argv[2]](args).then(() => {}, err => console.log(err.message.bold.red))
        
        } else {
        
            commands[process.argv[2]]().then(() => {}, err => console.log(err.message.bold.red))
        
        }
    }   

}
