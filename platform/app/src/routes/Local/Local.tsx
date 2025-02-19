import React, { useEffect, useRef } from 'react';
import classnames from 'classnames';
import { useNavigate, useLocation } from 'react-router-dom';
import { DicomMetadataStore, MODULE_TYPES } from '@ohif/core';

import Dropzone from 'react-dropzone';
import filesToStudies from './filesToStudies';

import { extensionManager } from '../../App.tsx';

import { Icon, Button, LoadingIndicatorProgress } from '@ohif/ui';

const getLoadButton = (onDrop: (files: File[]) => void, text: string, isDir: boolean) => {
  return (
    <Dropzone
      onDrop={onDrop}
      noDrag
    >
      {({ getRootProps, getInputProps }) => (
        <div {...getRootProps()}>
          <Button
            rounded="full"
            variant="contained"
            disabled={false}
            endIcon={<Icon name="launch-arrow" />}
            className={classnames('font-medium', 'ml-2')}
            onClick={() => { }}
          >
            {text}
            {isDir ? (
              <input
                {...getInputProps()}
                webkitdirectory="true"
                mozdirectory="true"
              />
            ) : (
              <input {...getInputProps()} />
            )}
          </Button>
        </div>
      )}
    </Dropzone>
  );
};

type LocalProps = {
  modePath: string;
};

const loaderStyle = {
  border: '8px solid #f3f3f3',
  borderRadius: '50%',
  borderTop: '8px solid #3498db',
  width: '50px',
  height: '50px',
  animation: 'spin 2s linear infinite'
};

const spinKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

function Local({ modePath }: LocalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const [dropInitiated, setDropInitiated] = React.useState(false);

  // Initializing the dicom local dataSource
  const dataSourceModules = extensionManager.modules[MODULE_TYPES.DATA_SOURCE];
  const localDataSources = dataSourceModules.reduce((acc: any[], curr: any) => {
    const mods = [];
    curr.module.forEach((mod: any) => {
      if (mod.type === 'localApi') {
        mods.push(mod);
      }
    });
    return acc.concat(mods);
  }, []);

  const firstLocalDataSource = localDataSources[0];
  const dataSource = firstLocalDataSource.createDataSource({});

  const microscopyExtensionLoaded = extensionManager.registeredExtensionIds.includes(
    '@ohif/extension-dicom-microscopy'
  );

  const onDrop = async (acceptedFiles: File[]) => {
    console.log('Files received:', acceptedFiles);
    const studies = await filesToStudies(acceptedFiles, dataSource);

    const query = new URLSearchParams();

    if (microscopyExtensionLoaded) {
      const smStudies = studies.filter((id: string) => {
        const study = DicomMetadataStore.getStudy(id);
        return (
          study.series.findIndex((s: any) => s.Modality === 'SM' || s.instances[0].Modality === 'SM') >= 0
        );
      });

      if (smStudies.length > 0) {
        smStudies.forEach((id: string) => query.append('StudyInstanceUIDs', id));

        modePath = 'microscopy';
      }
    }

    studies.forEach((id: string) => query.append('StudyInstanceUIDs', id));
    query.append('datasources', 'dicomlocal');

    navigate(`/${modePath}?${decodeURIComponent(query.toString())}`);
  };

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  useEffect(() => {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = spinKeyframes;
    document.head.appendChild(styleSheet);
  }, []);
  // Checking for 'url' parameter in the query string
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const relativePath = queryParams.get('relativePath') || ''; // รับเส้นทางย่อยจาก query string
    const apiUrl = process.env.URL_API + `${encodeURIComponent(relativePath)}`;

    fetch(apiUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((fileList: string[]) => {
        const folderUrl = process.env.URL_DICOM + `${relativePath}`;
        const fileUrls = fileList.map(fileName => `${folderUrl}/${fileName}`);

        return Promise.all(fileUrls.map(async url => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch file from ${url}`);
          }
          const blob = await response.blob();
          return new File([blob], url.split('/').pop()!, { type: blob.type });
        }));
      })
      .then(files => {
        onDrop(files);
      })
      .catch(err => {
        console.error('Failed to fetch files from API:', err);
      });
  }, [location.search]);

  return (
    <Dropzone
      ref={dropzoneRef}
      onDrop={acceptedFiles => {
        setDropInitiated(true);
        onDrop(acceptedFiles);
      }}
      noClick
    >
      {({ getRootProps }) => (
        <div
          {...getRootProps()}
          style={{ width: '100%', height: '100%' }}
        >
          <div className="flex h-screen w-screen items-center justify-center ">
            <div className="bg-secondary-dark mx-auto space-y-2 rounded-lg py-8 px-8 drop-shadow-md">
              <img
                className="mx-auto block h-14"
                src="./ohif-logo.svg"
                alt="OHIF"
              />
              <div className="space-y-2 pt-4 text-center">
                {dropInitiated ? (
                  <div className="flex flex-col items-center justify-center pt-48">
                    <LoadingIndicatorProgress className={'h-full w-full bg-black'} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* <p className="text-base text-blue-300">
                      Note: You data is not uploaded to any server, it will stay in your local
                      browser application
                    </p> */}
                    <p className="text-xg text-primary-active pt-6 font-semibold">
                      Loading DICOM files here to load them in the Viewer
                    </p>
                    <div className="loader mx-auto" style={loaderStyle}></div>
                    {/* <p className="text-lg text-blue-300">Or click to </p> */}
                  </div>
                )}
              </div>
              {/* <div className="flex justify-around pt-4 ">
                {getLoadButton(onDrop, 'Load files', false)}
                {getLoadButton(onDrop, 'Load folders', true)}
              </div> */}
            </div>
          </div>
        </div>
      )}
    </Dropzone>
  );
}

export default Local;
