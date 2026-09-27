# Security

## Prototype boundary

Contradictor in this repository is a trusted-local prototype.

The execution backend can launch caller-specified executables and arguments using the permissions of the operating-system account running the service.

It is not designed to safely execute arbitrary untrusted code.

## Do not

Do not:

- expose the execution API directly to the public Internet;
- bind the execution service to a public interface;
- place a public tunnel in front of the execution backend;
- treat process timeouts as a security sandbox;
- use the backend with untrusted executable paths or arguments.

## Public demo

The browser demo under `demo/` is separate from the local execution backend. It uses deterministic illustrative behavior and does not execute arbitrary server-side programs.

## Reporting

Do not include credentials, API keys, access tokens, private repository contents, or personal information in public security reports.

For security concerns involving this competition release, contact Fulcrum Fortress Consulting through its official published contact channel.
