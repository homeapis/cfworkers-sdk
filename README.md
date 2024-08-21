# SDK for Cloudflare Workers
This beta package (unstable) includes a few tools we've found useful while developing on the Cloudflare Developer platform.

It includes code to reduce time to ship for the following edge computing services:
- A link shortening tool
- URL-based Image storage with Cloudflare R2
- Marketing tools like email collection with D1 (please, review applicable laws in your jurisdiction before storing personal user data)

It requires (for complete feature set only, lightweight mode coming in next months):
* The [itty-router](https://github.com/kwhitley/itty-router) package
* a Cloudflare Account
* Cloudflare Workers enabled on your account
* a Cloudflare D1 database on your account
* a Cloudflare R2 storage bucket on your account

# Documentation
We provide **experimental** documentation for the project on https://cfworkers-sdk.opensource.homeapis.com.

## Roadmap
We plan on supporting more Workers features in the coming months.

## Notice
This repository is based on the incredible [itty-router](https://github.com/kwhitley/itty-router) project, from @kwhitley. We provide this package under the terms of the [MIT license](https://github.com/homeapis/cfworkers-sdk/main/license), allowing you to contribute, distribute, copy, remix and re-use this project as freely as need be.

**We are not affiliated to, or endorsed by Cloudflare, nor the Cloudflare Workers® family of products in any manner.**