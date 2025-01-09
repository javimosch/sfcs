#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Default blacklist directories
const DEFAULT_BLACKLIST = ['node_modules'];

function getModuleName(filePath) {
    const parts = filePath.split('/');
    const index = parts.indexOf('components');
    if (index !== -1 && index + 1 < parts.length) {
        return parts[index + 1];
    }
    // Check if it's in views folder
    const viewsIndex = parts.indexOf('views');
    if (viewsIndex !== -1 && viewsIndex + 1 < parts.length) {
        return 'views';
    }
    return 'other';
}

function calculateComplexity(filePath, content) {
    let complexityScore = 0;
    const fileName = path.basename(filePath);
    const moduleName = getModuleName(filePath);

    // High complexity indicators
    if (/mixins\s*:\s*\[/i.test(content)) complexityScore += 30;
    if (/watch\s*:\s*{[^}]*immediate\s*:\s*true/i.test(content)) complexityScore += 20;
    if (/watch\s*:\s*{[^}]*deep\s*:\s*true/i.test(content)) complexityScore += 20;
    if (/filters\s*:\s*{/i.test(content)) complexityScore += 15;
    
    // Count lifecycle hooks
    const lifecycleHooks = (content.match(/\b(created|mounted|beforeMount|beforeCreate|updated|beforeUpdate|destroyed|beforeDestroy)\s*\(/g) || []).length;
    complexityScore += lifecycleHooks * 5;

    // Medium complexity indicators
    const computedCount = (content.match(/computed\s*:\s*{[^}]*}/g) || []).join('').split(',').length;
    complexityScore += computedCount * 3;

    const methodsCount = (content.match(/methods\s*:\s*{([^}]*})/) || [''])[0].split(',').length;
    complexityScore += methodsCount * 2;

    const simpleWatchers = (content.match(/watch\s*:\s*{[^}]*}/g) || []).length;
    complexityScore += simpleWatchers * 4;

    // Low complexity indicators (these don't add to complexity score)
    const hasProps = /props\s*:\s*{/i.test(content) || /props\s*:\s*\[/i.test(content);
    const hasData = /data\s*\(\s*\)\s*{/i.test(content) || /data\s*:\s*\(/i.test(content);

    // Determine complexity level
    let complexity;
    if (complexityScore >= 30) {
        complexity = 'high';
    } else if (complexityScore >= 10) {
        complexity = 'medium';
    } else {
        complexity = 'low';
    }

    return {
        file: fileName,
        path: filePath,
        module: moduleName,
        complexity,
        details: {
            lifecycleHooks,
            computedCount,
            methodsCount,
            hasWatchers: simpleWatchers > 0,
            hasMixins: /mixins\s*:\s*\[/i.test(content),
            hasFilters: /filters\s*:\s*{/i.test(content),
            hasProps,
            hasData
        }
    };
}

function scanFolder(folderPath, blacklist = [], analyzeComplexity = false) {
    const combinedBlacklist = [...DEFAULT_BLACKLIST, ...blacklist];
    const results = {
        total: 0,
        optionsApiCount: 0,
        compositionApiCount: 0,
        templateOnlyCount: 0,
        unclassifiedCount: 0,
        unclassifiedExample: '',
        complexity: analyzeComplexity ? {
            modules: {
                low: {},
                medium: {},
                high: {}
            },
            details: {
                low: [],
                medium: [],
                high: []
            }
        } : null
    };

    function processFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            results.total++;
            
            // Check if it's a template-only component
            const isTemplateOnly = (
                /<template[^>]*>/i.test(content) && 
                !/<script[^>]*>/i.test(content)
            );
            if (isTemplateOnly) {
                results.templateOnlyCount++;
                return;
            }

            // Check for script setup variations
            const hasScriptSetup = 
                /<script\s+setup\s*>/i.test(content) || 
                /<script\s+lang="[^"]+"\s+setup\s*>/i.test(content);

            // Check for Composition API patterns
            const hasCompositionApi = 
                hasScriptSetup ||
                /\bdefineComponent\s*\(/i.test(content) ||
                /\bsetup\s*\([^)]*\)\s*{/i.test(content) ||
                /\bref\s*\(/i.test(content) ||
                /\breactive\s*\(/i.test(content) ||
                /\btoRef\s*\(/i.test(content) ||
                /\bcomputed\s*\(/i.test(content) && !/computed\s*:\s*{/.test(content) ||
                /\bdefineProps\s*[<(]/i.test(content) ||
                /\bdefineEmits\s*[<(]/i.test(content) ||
                /\bwithDefaults\s*\(/i.test(content);

            // Check for Options API patterns
            const hasOptionsApi = 
                /data\s*\(\s*\)\s*{/i.test(content) ||
                /data\s*:\s*\(?function\s*\(\s*\)\s*{/i.test(content) ||
                /data\s*:\s*{/i.test(content) ||
                /methods\s*:\s*{/i.test(content) ||
                /computed\s*:\s*{/i.test(content) ||
                /watch\s*:\s*{/i.test(content) ||
                /props\s*:\s*{/i.test(content) ||
                /props\s*:\s*\[/i.test(content) ||
                /components\s*:\s*{/i.test(content) ||
                /filters\s*:\s*{/i.test(content) ||
                /mixins\s*:\s*\[/i.test(content) ||
                /created\s*\(\s*\)\s*{/i.test(content) ||
                /mounted\s*\(\s*\)\s*{/i.test(content) ||
                /beforeMount\s*\(\s*\)\s*{/i.test(content) ||
                /beforeCreate\s*\(\s*\)\s*{/i.test(content) ||
                /name\s*:\s*['"]/i.test(content) ||
                /export\s+default\s*{/i.test(content);

            if (hasCompositionApi) {
                results.compositionApiCount++;
            } else if (hasOptionsApi) {
                results.optionsApiCount++;
                
                // If complexity analysis is enabled, analyze the component
                if (analyzeComplexity) {
                    const analysis = calculateComplexity(filePath, content);
                    const moduleName = analysis.module;
                    
                    // Update module counts
                    if (!results.complexity.modules[analysis.complexity][moduleName]) {
                        results.complexity.modules[analysis.complexity][moduleName] = 0;
                    }
                    results.complexity.modules[analysis.complexity][moduleName]++;
                    
                    // Store detailed analysis
                    results.complexity.details[analysis.complexity].push(analysis);
                }
            } else if (/<script[^>]*>/i.test(content)) {
                results.unclassifiedCount++;
                if (!results.unclassifiedExample) {
                    results.unclassifiedExample = filePath;
                }
                // Debug info for unclassified components
                console.warn(`Unclassified SFC (${filePath}):`);
                const scriptContent = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1] || '';
                console.warn('Script content:', scriptContent.trim());
            }
        } catch (err) {
            console.error(`Error reading file ${filePath}: ${err.message}`);
        }
    }

    function traverseFolder(currentPath) {
        if (combinedBlacklist.includes(path.basename(currentPath))) {
            return;
        }

        const items = fs.readdirSync(currentPath);
        for (const item of items) {
            const itemPath = path.join(currentPath, item);
            if (fs.statSync(itemPath).isDirectory()) {
                traverseFolder(itemPath);
            } else if (item.endsWith('.vue')) {
                processFile(itemPath);
            }
        }
    }

    traverseFolder(folderPath);
    return results;
}

function printBasicResults(result) {
    console.log('\nSFC Analysis');
    console.log('============');
    console.log(`Total SFCs: ${result.total}`);
    console.log(`Options API SFCs: ${result.optionsApiCount} (${((result.optionsApiCount / result.total) * 100).toFixed(2)}%)`);
    console.log(`Composition API SFCs: ${result.compositionApiCount} (${((result.compositionApiCount / result.total) * 100).toFixed(2)}%)`);
    console.log(`Template-only SFCs: ${result.templateOnlyCount} (${((result.templateOnlyCount / result.total) * 100).toFixed(2)}%)`);
    console.log(`Unclassified SFCs: ${result.unclassifiedCount} (${((result.unclassifiedCount / result.total) * 100).toFixed(2)}%)`);
    if (result.unclassifiedCount > 0) {
        console.log(`Example unclassified SFC: ${result.unclassifiedExample}`);
    }
}

function printComplexityResults(result) {
    const totals = {
        low: Object.values(result.complexity.modules.low).reduce((a, b) => a + b, 0),
        medium: Object.values(result.complexity.modules.medium).reduce((a, b) => a + b, 0),
        high: Object.values(result.complexity.modules.high).reduce((a, b) => a + b, 0)
    };

    console.log('\nComplexity Analysis');
    console.log('==================');
    console.log(`\nBreakdown:`);

    // Print Low Complexity
    console.log(`\nLow Complexity: ${totals.low} (${((totals.low / result.optionsApiCount) * 100).toFixed(2)}%)`);
    Object.entries(result.complexity.modules.low).forEach(([module, count]) => {
        const percentage = ((count / totals.low) * 100).toFixed(2);
        console.log(`    ${module}: ${count} (${percentage}%)`);
    });

    // Print Medium Complexity
    console.log(`\nMedium Complexity: ${totals.medium} (${((totals.medium / result.optionsApiCount) * 100).toFixed(2)}%)`);
    Object.entries(result.complexity.modules.medium).forEach(([module, count]) => {
        const percentage = ((count / totals.medium) * 100).toFixed(2);
        console.log(`    ${module}: ${count} (${percentage}%)`);
    });

    // Print High Complexity
    console.log(`\nHigh Complexity: ${totals.high} (${((totals.high / result.optionsApiCount) * 100).toFixed(2)}%)`);
    Object.entries(result.complexity.modules.high).forEach(([module, count]) => {
        const percentage = ((count / totals.high) * 100).toFixed(2);
        console.log(`    ${module}: ${count} (${percentage}%)`);
    });

    // Print detailed breakdown
    console.log('\nDetailed Component List');
    console.log('=====================');

    ['low', 'medium', 'high'].forEach(complexity => {
        console.log(`\n${complexity.toUpperCase()} Complexity Components:`);
        console.log('='.repeat(25));
        
        // Group components by module
        const moduleGroups = result.complexity.details[complexity].reduce((acc, item) => {
            if (!acc[item.module]) {
                acc[item.module] = [];
            }
            acc[item.module].push(item);
            return acc;
        }, {});

        // Print components grouped by module
        Object.entries(moduleGroups).forEach(([module, items]) => {
            console.log(`\nModule: ${module}`);
            items.forEach(item => {
                console.log(`\nFile: ${item.file}`);
                console.log(`Path: ${item.path}`);
                if (complexity === 'high') {
                    console.log('Complexity Factors:');
                    console.log(` - Lifecycle Hooks: ${item.details.lifecycleHooks}`);
                    console.log(` - Computed Properties: ${item.details.computedCount}`);
                    console.log(` - Methods: ${item.details.methodsCount}`);
                    if (item.details.hasMixins) console.log(' - Uses mixins');
                    if (item.details.hasFilters) console.log(' - Uses filters');
                    if (item.details.hasWatchers) console.log(' - Has watchers');
                }
            });
        });
    });
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    folder: './',
    blacklist: [],
    complexity: false
};

args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key === '--folder') {
        options.folder = value;
    } else if (key === '--blacklist') {
        options.blacklist = value.split(',');
    } else if (key === '--complexity') {
        options.complexity = true;
    }
});

// Run the analysis
const result = scanFolder(options.folder, options.blacklist, options.complexity);

// Print results
printBasicResults(result);
if (options.complexity) {
    printComplexityResults(result);
}
