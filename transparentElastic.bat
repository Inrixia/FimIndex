@echo off
%Windir%\System32\WindowsPowerShell\v1.0\Powershell.exe -command "$Host.UI.RawUI.WindowTitle = 'Transparent Plastic - Elastic Proxy'"
:J
node transparentPlastic.js
goto J