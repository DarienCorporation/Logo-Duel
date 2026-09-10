Logo Duel

A focused web application for comparing logo concepts and collecting structured feedback through anonymous head-to-head voting.

Logo Duel allows participants to compare two logo concepts at a time, choose the stronger option, or skip a matchup. The owner can manage concepts, publish the test, and review voting results.

Overview

Logo Duel is designed to make logo selection more objective by replacing informal opinions with structured comparisons.

Instead of asking participants to rank several logos at once, the application presents two concepts and asks:

Which logo works best?

The collected comparisons can then be reviewed by the test owner to identify emerging preferences.

Features

* Anonymous head-to-head logo voting
* Randomized logo matchups
* Balanced matchup selection
* Skip matchup functionality
* Session progress tracking
* Owner-only concept management
* Add new logo concepts
* Rename logo concepts
* Reorder concepts
* Remove concepts
* Publish test state
* Copy test link
* Private owner results
* Win/loss statistics
* Comparison totals
* Responsive design for desktop, tablet, and mobile
* Reduced-motion accessibility support
* Clean and focused visual interface

Technology

Logo Duel is currently built as a lightweight client-side web application.

* HTML5
* CSS3
* JavaScript
* Tailwind CSS
* Lucide Icons
* Google Fonts
* Canva Data SDK

External libraries are loaded through CDN resources where applicable.

Project Structure

Logo_Duel/
├── index.html
├── Logo_Duel_logo.jpeg
└── README.md

Running Locally

Because Logo Duel is currently a static HTML application, it can be opened directly in a browser.

For the best experience, however, serve the project through a local web server rather than opening the HTML file directly.

Deployment

Logo Duel can be deployed as a static website using services such as:

* Vercel
* GitHub Pages
* Netlify
* Cloudflare Pages

The project does not require a traditional frontend build process in its current form.

Data & Voting

The current implementation uses the Canva Data SDK for storing:

* Votes
* Skipped matchups
* Logo concepts
* Test state
* Voting results

The application is designed around anonymous feedback. No personal information is intentionally collected by the voting interface.

Important

The current version contains Canva-specific SDK dependencies.

If the project is deployed outside Canva, the visual interface may load correctly, but the voting and persistence functionality may not work because the Canva Data SDK is not available in a normal external hosting environment.

A future production version should replace the Canva Data SDK with a dedicated backend and database.

Future Development

Planned improvements include:

* Dedicated production backend
* Persistent database
* Secure owner authentication
* Proper authorization and access control
* Production logo image storage
* Real image uploads
* Public test links
* Unique test identifiers
* Multiple logo tests
* Improved statistical analysis
* Duplicate-vote protection
* Test participant controls
* Owner dashboard
* Improved analytics
* Production-grade security
* Custom domain support

Security

The current version is a prototype implementation and should not be considered production-secure.

The owner access mechanism currently uses a client-side passcode and is therefore not suitable for protecting sensitive results or administrative functionality in a production environment.

A production deployment should use server-side authentication and authorization.

Design Principles

Logo Duel follows a simple design philosophy:

* Focus the participant on one decision at a time
* Keep the interface visually calm
* Make comparisons easy to understand
* Avoid unnecessary information during voting
* Present results clearly without overstating limited data
* Maintain a responsive experience across devices

License

Copyright © Darien Corporation. All rights reserved.

This project and its source code are proprietary to Darien Corporation unless otherwise stated.

Unauthorized copying, modification, distribution, or commercial use is prohibited.

Author

Darien Corporation

Logo Duel is a project developed under Darien Corporation.