#!/usr/bin/env python3
"""Install per-user launchers. Run while the custom Server is stopped."""
import os,plistlib,shutil,sqlite3,subprocess
from pathlib import Path
root=Path(__file__).resolve().parent
ps=subprocess.check_output(['/bin/ps','-U',str(os.getuid()),'-o','comm='],text=True)
if any(line.strip().endswith('/Contents/MacOS/BlueBubbles') for line in ps.splitlines()):raise SystemExit('Stop this user\'s Server before installing startup configuration')
support=Path.home()/'Library/Application Support/BlueBubblesCustom';support.mkdir(parents=True,exist_ok=True)
for name in ['ensure_running.sh','health.py']:shutil.copy2(root/name,support/name)
agents=Path.home()/'Library/LaunchAgents';agents.mkdir(parents=True,exist_ok=True)
logs=Path.home()/'Library/Logs'
items=[('com.bluebubbles.server',{'ProgramArguments':['/bin/bash',str(support/'ensure_running.sh')],'RunAtLoad':True,'LimitLoadToSessionType':'Aqua'}),('local.bluebubbles.custom-health',{'ProgramArguments':['/usr/bin/python3',str(support/'health.py'),'--strict'],'StartInterval':300,'LimitLoadToSessionType':'Aqua'})]
for label,config in items:
 config.update(Label=label,StandardOutPath=str(logs/(label+'.log')),StandardErrorPath=str(logs/(label+'.err.log')))
 file=agents/(label+'.plist')
 if file.exists():shutil.copy2(file,str(file)+'.before-custom')
 with file.open('wb') as f:plistlib.dump(config,f)
 subprocess.run(['/bin/launchctl','bootout',f'gui/{os.getuid()}/{label}'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['/bin/launchctl','enable',f'gui/{os.getuid()}/{label}'],check=True)
# Match the app's launch-agent setting, so its UI can disable the same service later.
db=sqlite3.connect(str(Path.home()/'Library/Application Support/bluebubbles-server/config.db'))
db.execute("update config set value='launch-agent' where name='auto_start_method'");db.execute("update config set value='0' where name='auto_install_updates'");db.commit();db.close()
for label,_ in items:subprocess.run(['/bin/launchctl','bootstrap',f'gui/{os.getuid()}',str(agents/(label+'.plist'))],check=True)
print('Installed user-login Server/bridge sequencing and five-minute health reporting')
