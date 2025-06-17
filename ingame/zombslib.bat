@echo off
rd /s /q C:\Users\%USERNAME%\Desktop\ZRPS\ingame\node_modules\zombslib\dist
cd C:\Users\%USERNAME%\Desktop\zombslib
cmd /c "npx tsc"
xcopy /e /i C:\Users\%USERNAME%\Desktop\zombslib\dist C:\Users\%USERNAME%\Desktop\ZRPS\ingame\node_modules\zombslib\dist
cd C:\Users\%USERNAME%\Desktop\ZRPS\ingame
