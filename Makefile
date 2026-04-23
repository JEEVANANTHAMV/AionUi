
cat-config:
	@base64 -D -i ~/.forjinn-desk-config-dev/forjinn-desk-config.txt | python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read()))' | pbcopy
