import os  
import sys  
import time  
import random  
import colorama  
from colorama import Fore, Style  

colorama.init(autoreset=True)  

# Safety warnings and educational disclaimers  
print(Fore.YELLOW + "WARNING: This script is for educational purposes only. It simulates a ransomware attack and should not be used maliciously.")  
print(Fore.YELLOW + "Make sure to run this only in a safe environment: /tmp/ or ./test directories.")  

# Function for the reconnaissance phase  
def reconnaissance():  
    print(Fore.RED + "[RECONNAISSANCE]: Scanning environment...")  
    time.sleep(2)  
    print(Fore.GREEN + "[INFO]: Environment scanned. Proceeding to privilege escalation.")  

# Function to simulate privilege escalation  
def privilege_escalation():  
    print(Fore.RED + "[PRIVILEGE ESCALATION]: Attempting to gain higher privileges...")  
    time.sleep(1)  
    print(Fore.GREEN + "[INFO]: Privileges escalated successfully.")  

# Function to simulate file encryption  
def encrypt_files(files):  
    for file in files:  
        print(Fore.RED + f"[ENCRYPTING]: {file}")  
        for i in range(101):  
            time.sleep(0.1)  
            print(Fore.RED + f"[ENCRYPTION PROGRESS]: {i}%", end='\r')  
        print(Fore.GREEN + f"[SUCCESS]: {file} encrypted.")  

# Function to delete shadow copies  
def delete_shadow_copies():  
    print(Fore.RED + "[SHADOW COPY DELETION]: Deleting shadow copies...")  
    time.sleep(2)  
    print(Fore.GREEN + "[INFO]: Shadow copies deleted.")  

# Function for data exfiltration simulation  
def data_exfiltration():  
    print(Fore.RED + "[DATA EXFILTRATION]: Exfiltrating data...")  
    time.sleep(3)  
    print(Fore.GREEN + "[INFO]: Data exfiltrated successfully.")  

# Function to create a ransom note  
def create_ransom_note():  
    with open('ransom_note.txt', 'w') as note:  
        note.write(f"Your files have been encrypted.\n\nFollow these steps to recover your files:\n- Back up your data based on the 3-2-1-1-0 strategy.\n- Ensure you have offline backups.\n\nMITRE ATT&CK References:\n- Initial Access\n- Execution\n- Impact")  
    print(Fore.GREEN + "[INFO]: Ransom note created.")  

# Function for recovery/decryption  
def decrypt_files():  
    print(Fore.GREEN + "[RECOVERY MODE]: Decrypting files...")  
    time.sleep(2)  
    print(Fore.GREEN + "[INFO]: Files decrypted successfully.")

# Main function to control the flow  
def main():  
    if len(sys.argv) > 1 and sys.argv[1] == '--decrypt':  
        decrypt_files()  
    else:  
        # List of demo files  
        demo_files = ["report1.txt", "customer_db.txt", "backup_code.py"]  
        reconnaissance()  
        privilege_escalation()  
        encrypt_files(demo_files)  
        delete_shadow_copies()  
        data_exfiltration()  
        create_ransom_note()  

# Entry point  
if __name__ == '__main__':  
    # Check if running in safe directories  
    if os.getcwd() not in ['/tmp', './test']:  
        print(Fore.RED + "[ERROR]: This script can only be executed in /tmp/ or ./test directories.")  
        sys.exit(1)  
    main()  
