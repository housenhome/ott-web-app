# Updating from the JW Player Repository and Pushing Updates

To keep your forked repository up-to-date with changes from the original repository, follow these steps:

## Setting Upstream Remote Branch (One-time setup)

Run the following command to set the upstream remote branch URL. This needs to be done only once:

```bash
git remote add upstream https://github.com/jwplayer/ott-web-app
```

## Applying Updates

To fetch and apply updates from the original repository, use the following command, specifying the remote branch name (e.g., 'develop' from JWPlayer's repo):

```bash
git pull upstream develop
```

If there are conflicting changes between your local repository and the upstream branch, merge conflicts might occur. Resolve these conflicts by making necessary changes.

## Pushing Changes to Your Repository

We have two main branches: main (for HH container) and md-main (for MD container)
Every push or pull request to either of the two branches will trigger a github action that will deploy the updates to the firebase container

```bash
git push origin <branch-name>
```

Replace <branch-name> with the appropriate branch name (e.g., 'main' or 'md-main').
