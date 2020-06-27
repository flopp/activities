#!/usr/bin/env python3
import os
import setuptools


def _read_reqs(relpath):
    abspath = os.path.join(os.path.dirname(__file__), relpath)
    with open(abspath) as f:
        return [
            s.strip()
            for s in f.readlines()
            if s.strip() and not s.strip().startswith("#")
        ]


setuptools.setup(
    name="activities",
    version="0.1.0",
    install_requires=_read_reqs("requirements.txt"),
    extras_require={"dev": _read_reqs("requirements-dev.txt"),},
    entry_points={"console_scripts": ["activities = activities.run:run",],},
    packages=setuptools.find_packages(),
    include_package_data=True,
)
