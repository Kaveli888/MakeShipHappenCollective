# MakeShipHappenCollective

A developer toolkit and automation hub for shipping projects faster. This repo contains scripts, templates, and CLI integrations that streamline common development workflows — from generating documentation to automating code reviews.

## Features

- **README summarizer** – pipe any README through the ChatGPT CLI and get a clean markdown summary
- **Git helpers** – auto-generate commit messages and changelogs from diffs
- **Codex integration** – run agentic code tasks directly from the terminal
- **Shell aliases** – a curated set of productivity aliases for zsh
- **API key management** – secure patterns for storing and loading OpenAI credentials

## Requirements

- macOS (zsh)
- [chatgpt-cli](https://github.com/kardolus/chatgpt-cli) installed and in `$PATH`
- `OPENAI_API_KEY` set in your environment or loaded from macOS Keychain
- An OpenAI account with **active billing** — the free tier does not include API access.
  Add a credit card and purchase credits at https://platform.openai.com/settings/organization/billing.
  `gpt-4o-mini` is the default model and the most cost-effective option.

## Installation

```bash
git clone https://github.com/jake/MakeShipHappenCollective.git
cd MakeShipHappenCollective
chmod +x *.sh
```

Add to your `~/.zshrc`:

```bash
export OPENAI_API_KEY="$(security find-generic-password -a "$USER" -s OPENAI_API_KEY -w)"
source ~/MakeShipHappenCollective/aliases.zsh
```

## Usage

### `summarize_readme.sh`

Generates a markdown summary of any README using the ChatGPT CLI.

```bash
./summarize_readme.sh --help
```

```
Usage: summarize_readme.sh [README_FILE] [OPTIONS]

Generates a markdown summary of a README file using the chatgpt CLI.
If README_FILE is omitted, auto-detects README.md / README.rst / README.txt.

Options:
  -o, --output <file>   Write summary to <file> instead of stdout
  -m, --model  <name>   Override the ChatGPT model (e.g. gpt-4o, gpt-4o-mini)
                        Can also be set via CHATGPT_MODEL env var
  -h, --help            Show this help message and exit
```

**Examples:**

```bash
# Auto-detect README in current directory, print to terminal
./summarize_readme.sh

# Summarize a specific file
./summarize_readme.sh path/to/README.md

# Save the summary to a file
./summarize_readme.sh -o summary.md

# Use a specific model
./summarize_readme.sh -m gpt-4o-mini -o summary.md

# Override model via environment variable
CHATGPT_MODEL=gpt-4o ./summarize_readme.sh -o summary.md
```

### Other workflows

```bash
# Generate a commit message from staged changes
git diff --staged | chatgpt -q "Write a conventional commit message"

# Run an agentic coding task
codex exec "Add error handling to all functions in src/"
```

## License

MIT
