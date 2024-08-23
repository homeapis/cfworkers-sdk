# Contributing

`@homeapis/cfworkers-sdk` is an open source project and we welcome contributions from you. Thank you!

Below you can find some guidance on how to be most effective when contributing to the project.

## Before getting started

We really appreciate your interest in making a contribution, and we want to make sure that the process is as smooth and transparent as possible! To this end, we note that the HomeAPIs team is actively doing development in this repository, and while we consistently strive to communicate status and current thinking around all open issues, there may be times when context surrounding certain items is not up to date. Therefore, **for non-trivial changes, please always engage on the issue or create a discussion or feature request issue first before writing your code.** This will give us opportunity to flag any considerations you should be aware of before you spend time developing. Of course for trivial changes, please feel free to go directly to filing a PR, with the understanding that the PR itself will serve as the place to discuss details of the change.

Thanks you very much for helping us improve [@homeapis/cfworkers-sdk](https://github.com/homeapis.com/cfworkers-sdk). We look forward to your contribution!

## Getting started

### Set up your environment

`@homeapis/cfworkers-sdk` is built and run on the Node.js JavaScript runtime. It is not to be confused with Cloudflare's official `wrangler` CLI, found at [`workers-sdk`](https://github.com/cloudflare/workers-sdk).

> [!NOTE]
> We're currently looking forward to updating the package's name for easier distinguishing of both projects.
> 
> As the project evolves to respond to one specific need, we'll rename the tool, as well as its repository. For now, it remains `@homeapis/cfworkers-sdk` (prefixed by `@homeapis` for easier identification).

- Install the latest LTS version of [Node.js](https://nodejs.dev/) - we recommend using a Node version manager like [nvm](https://github.com/nvm-sh/nvm).
- Install a code editor - we recommend using [VS Code](https://code.visualstudio.com/).
  - When opening the project in VS Code for the first time, it will prompt you to install the [recommended VS Code extensions](https://code.visualstudio.com/docs/editor/extension-marketplace#:~:text=install%20the%20recommended%20extensions) for the project.
- Install the [git](https://git-scm.com/) version control tool.

### Fork and clone this repository

Any contributions you make will be via [Pull Requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) on [GitHub](https://github.com/) developed in a local git repository and pushed to your own fork of the repository.

- Ensure you have [created an account](https://docs.github.com/en/get-started/onboarding/getting-started-with-your-github-account) on GitHub.
- [Create your own fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) of [this repository](https://github.com/cloudflare/workers-sdk).
- Clone your fork to your local machine
  ```sh
  > git clone https://github.com/<your-github-username>/cfworkers-sdk
  > cd cfworkers-sdk
  ```
  You can see that your fork is setup as the `origin` remote repository.
  Any changes you wish to make should be in a local branch that is then pushed to this origin remote.
  ```sh
  > git remote -v
  origin	https://github.com/<your-github-username>/cfworkers-sdk (fetch)
  origin	https://github.com/<your-github-username>/cfworkers-sdk (push)
  ```
- Add `homeapis/cfworkers-sdk` as the `upstream` remote repository.
  ```sh
  > git remote add upstream https://github.com/homeapis/cfworkers-sdk
  > git remote -v
  origin	https://github.com/<your-github-username>/cfworkers-sdk (fetch)
  origin	https://github.com/<your-github-username>/cfworkers-sdk (push)
  upstream	https://github.com/homeapis/cfworkers-sdk (fetch)
  upstream	https://github.com/homeapis/cfworkers-sdk (push)
  ```
- You should regularly pull from the `main` branch of the `upstream` repository to keep up to date with the latest changes to the project.
  ```sh
  > git switch main
  > git pull upstream main
  From https://github.com/homeapis/cfworkers-sdk
  * branch            main       -> FETCH_HEAD
  Already up to date.
  ```

### Install dependencies

## Building and running

## Checking the code

### Type Checking

### Linting

The code is checked for linting errors by [ESLint](https://eslint.org/).

- Run the linting checks
  ```sh
  > pnpm run check:lint
  ```
- The repository has a recommended VS Code plugin to run ESLint checks while editing source code, providing immediate feedback.

### Formatting

The code is checked for formatting errors by [Prettier](https://prettier.io/).

- Run the formatting checks
  ```sh
  > npm run pretty
  ```

### Testing

More on that in further updates.

## Steps For Making Changes

Every change you make should be stored in a [git commit](https://github.com/git-guides/git-commit).
Changes should be committed to a new local branch, which then gets pushed to your fork of the repository on GitHub.

- Ensure your `main` branch is up to date
  ```sh
  > git switch main
  > git pull upstream main
  ```
- Create a new branch, based off the `main` branch
  ```sh
  > git checkout -b <new-branch-name> main
  ```
- Stage files to include in a commit
  - Use [VS Code](https://code.visualstudio.com/docs/editor/versioncontrol#_git-support)
  - Or add and commit files via the command line
  ```sh
  > git add <paths-to-changes-files>
  > git commit
  ```
- Push changes to your fork
  ```sh
  git push -u origin <new-branch-name>
  ```
- Once you are happy with your changes, create a Pull Request on GitHub
- The format for Pull Request titles is `[package name] description`, where the package name should indicate which package of the `cfworkers-sdk` monorepo your PR pertains to (e.g. `cryptoKit`/`networkKit`/`imagesKit`), and the description should be a succinct summary of the change you're making.
- GitHub will insert a template for the body of your Pull Request—it's important to carefully fill out all the fields, giving as much detail as possible to reviewers.

## PR Review

PR review is a critical and required step in the process for landing changes. This is an opportunity to catch potential issues, improve the quality of the work, celebrate good design, and learn from each other.

As a reviewer, it's important to be thoughtful about the proposed changes and communicate any feedback. Examples of PR reviews that the community has identified as particularly high-caliber are labeled with the `highlight pr review` label. Please feel empowered to use these as a learning resource.

## PR Tests

*Needs more time to update.*