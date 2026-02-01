from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="django-qlab",
    version="0.1.0",
    author="Tabea Hoehne",
    description="Dynamic query API for Django REST Framework with advanced filtering and metadata",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/tabeahoehne132/django-qlab",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Framework :: Django",
        "Framework :: Django :: 4.0",
        "Framework :: Django :: 4.1",
        "Framework :: Django :: 4.2",
        "Framework :: Django :: 5.0",
    ],
    python_requires=">=3.9",
    install_requires=[
        "Django>=4.0",
        "djangorestframework>=3.14",
        "pydantic>=2.0",
        "drf-spectacular>=0.26",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0",
            "pytest-django>=4.5",
            "black>=23.0",
            "ruff>=0.1",
        ],
    },
)