"""Banco de pruebas de la base de datos. Levanta un PostgreSQL temporal, imita lo mínimo de Supabase
(auth.users, auth.uid(), storage, roles anon/authenticated), carga supabase/schema.sql DOS veces
(repetible) y deja ejecutar consultas como un usuario concreto.
Uso: python3 tests/db/test_db.py   (requiere PostgreSQL 16 instalado y ejecutarse como root)"""
import os, subprocess, shutil, time, re

BIN = next((p for p in ["/usr/lib/postgresql/16/bin", "/usr/lib/postgresql/15/bin", "/usr/lib/postgresql/14/bin"] if os.path.isdir(p)), None)
D, SOCK, PORT = "/var/tmp/pgtest", "/var/tmp", "5433"
HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = os.path.join(HERE, "..", "..", "supabase", "schema.sql")
UID = {}
passed = failed = 0

def sh(cmd): return subprocess.run(cmd, shell=True, capture_output=True, text=True)
def psql(sql=None, f=None, db="t", user="postgres"):
    a = ["psql", "-h", SOCK, "-p", PORT, "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"]
    a += ["-f", f] if f else ["-c", sql]
    r = subprocess.run(a, capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr).strip()

def start():
    sh(f"su postgres -c '{BIN}/pg_ctl -D {D} stop' 2>/dev/null"); shutil.rmtree(D, ignore_errors=True); os.makedirs(D); sh(f"chown postgres {D}; chmod 777 {SOCK}")
    assert sh(f"su postgres -c '{BIN}/initdb -D {D} -A trust'").returncode == 0
    sh(f"su postgres -c \"{BIN}/pg_ctl -D {D} -o '-p {PORT} -k {SOCK}' -l {D}/log start\""); time.sleep(2)
    psql("create database t", db="postgres"); ok, o = psql(f=os.path.join(HERE, "stub.sql")); assert ok, o
    for n in (1, 2):
        ok, o = psql(f=SCHEMA); assert ok, f"schema pasada {n}: {o}"
def stop(): sh(f"su postgres -c '{BIN}/pg_ctl -D {D} stop'")

def user(name, email=None):
    u = "%08d-0000-0000-0000-%012d" % (len(UID) + 1, len(UID) + 1); UID[name] = u
    psql(f"insert into auth.users values ('{u}', '{email or name + '@x.com'}')"); return u
def q(who, sql):
    """Ejecuta como usuario ('anon', 'srv' = dueño sin RLS, o un nombre creado con user())."""
    if who == "srv": return psql(sql)
    pre = "set role anon;" if who == "anon" else f"set role authenticated; set request.uid='{UID[who]}';"
    ok, o = psql(pre + " " + sql); return ok, "\n".join(l for l in o.splitlines() if l != "SET")

def check(name, cond, info=""):
    global passed, failed
    if cond: passed += 1; print("  ok  ", name)
    else: failed += 1; print("  FALLA", name, "->", info)
def val(who, sql):
    ok, o = q(who, sql); return o if ok else "ERR: " + o
def fails(who, sql, msg=""):
    ok, o = q(who, sql); return (not ok) and msg.lower() in o.lower()
def summary():
    print(f"\n{passed} pruebas pasaron, {failed} fallaron"); return failed == 0
