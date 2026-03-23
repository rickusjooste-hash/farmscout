@echo off
cd /d C:\farmscout\scripts
C:\Python314\python.exe -c "import os; os.chdir('C:/farmscout/scripts'); g = {'__file__': os.path.abspath('sync-paltrack.py'), '__name__': '__run__'}; code = open('sync-paltrack.py').read().replace(\"if __name__ == '__main__':\", 'if False:'); exec(compile(code, 'sync-paltrack.py', 'exec'), g); g['sync']()"
