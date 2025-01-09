# SFCS - Single File Component Scanner

SFCS is a command-line tool designed to analyze Vue Single File Components (SFCs) for their structure and complexity, with a focus on migration readiness from Vue 2 to Vue 3. It helps developers understand the composition of their Vue components and provides insights into which files should be prioritized for migration to the Composition API.

## Features
- Scans Vue components for Options API and Composition API usage.
- **Analyzes migration readiness**: The CLI focuses on analyzing migration from Vue 2 to Vue 3, specifically targeting Options API SFCs to understand which files should be prioritized for migration to the Composition API.
- Analyzes complexity based on various factors such as lifecycle hooks, computed properties, and more.
- Provides a detailed breakdown of components by complexity and module.

## Installation
To use SFCS, clone the repository and install the dependencies:

```bash
npm install
```

## Usage
### Basic Analysis
To perform a basic analysis of SFCs in a specified folder:
```bash
sfcs --folder=/path/to/project
```

### Complexity Analysis
To enable detailed complexity analysis:
```bash
sfcs --folder=/path/to/project --complexity
```

## Options
- `--folder=<path>`: Specify the folder to scan (default: current directory).
- `--blacklist=<dirs>`: Comma-separated list of directories to ignore.
- `--complexity`: Enable complexity analysis.

## License
This project is licensed under the ISC License.
